# Game Tech & Engine Architecture

This document tracks technical decisions, engine configurations, and architectural learnings while building the FPS game in Babylon.js.

## 1. Engine Initialization (WebGPU)

### 1.1 The WebGPU Shader Compilation Limit
Babylon.js 6.0+ introduced the `WebGPUEngine`, which offers significant performance improvements over traditional WebGL in terms of draw calls and compute shaders. The project defaults to `WebGPUEngine`.

Initially, integrating `Soldier.glb` caused a silent crash.
- **The Cause:** `Soldier.glb` relies heavily on Skeletal Animations (bone skinning). When Babylon's WebGPU pipeline attempts to compile the shaders, it exceeded the WebGPU limit for fragment input variables (`Total fragment input variables count (17) exceeds the maximum (16)`).
- **The Solution:** We explicitly disable vertex colors (`mesh.useVertexColors = false`) when loading external GLB models. This removes one `vec4` varying from the fragment shader, bringing the total back under the hard limit of 16 and allowing WebGPU to compile successfully.

### 1.2 WebGL Fallback
If the user's browser does not support WebGPU (or if they manually select WebGL in the deployment menu), the engine automatically falls back to `new Engine()` (WebGL 2.0).

```typescript
import { Engine } from '@babylonjs/core';

// Stable Initialization
async function initEngine(canvas: HTMLCanvasElement): Promise<Engine> {
    // true enables hardware antialiasing (MSAA)
    const engine = new Engine(canvas, true); 
    
    // WebGL engine initializes synchronously, unlike WebGPU's initAsync()
    return engine;
}
```

### 1.3 Future Upgrade Path
If we wish to utilize WebGPU in the future for massive performance gains (e.g., rendering hundreds of bots), we must:
1. Ensure bone counts per mesh do not exceed default WebGPU limits.
2. Pre-compile shaders using `engine.compileMaterialsAsync`.
3. Implement a fallback system that automatically catches WebGPU initialization errors and gracefully downgrades the user to WebGL 2.

## 2. Model Loading (glTF/GLB)

- **Asynchronous Container:** Always use `SceneLoader.LoadAssetContainerAsync` to load assets into memory *without* immediately adding them to the scene. 
- **Instancing:** Use `container.instantiateModelsToScene()` to stamp copies of the model. This allows us to spawn multiple bots sharing the same geometry in memory.
- **Frustum Culling:** Because of Babylon.js's bounding box calculation on rigged models, moving arms can swing outside the invisible bounding box, causing the engine to aggressively stop rendering the mesh if you look away. We iterate through `getChildMeshes()` and set `alwaysSelectAsActiveMesh = true` to prevent this glitch.

## 3. Physics Integration (Havok)
We utilize **Havok Physics** (integrated natively into Babylon V6+) for accurate collision detection, gravity, and movement.

### 3.1 The Capsule Architecture
Both the Player and the Bots are not directly manipulated in world space. Instead, they are wrapped in an invisible `PhysicsShapeType.CAPSULE`.
- **Why Capsules?** Capsules prevent snagging on stairs or sharp geometry corners, allowing smooth sliding along walls.
- **Friction & Restitution:** The player capsule uses `friction: 0.0` (to prevent sticking to walls while moving) and `restitution: 0` (no bounciness).
- **Locking Rotation:** We lock the physics aggregate's angular velocity to `Vector3.Zero()` every frame. Without this, colliding off-center with a crate would cause the player to spin out of control like a top.

### 3.2 Physics-Based Movement vs Transform-Based Movement
Instead of manually updating the player's `position` (which breaks collision responses), movement is achieved by applying direct `LinearVelocity` to the physics body.
- We calculate the desired world-space movement vector based on the camera's `yaw` (bypassing the physics body's internal rotation, which is locked to 0).
- We use `Scalar.Lerp` (or custom moveTowards math) to smoothly accelerate the velocity toward the target speed.
- The physics engine seamlessly handles the collision against walls and the gravity acceleration.

## 4. High-Detail Character Architecture

### 4.1 First-Person Viewmodel (The Player)
To achieve a AAA feel, we do not simply put a camera inside the head of a full-body mesh. We use a dedicated viewmodel technique:
1. **The Sway Root:** The camera has a child `TransformNode` called `swayRoot`.
2. **The Viewmodel Mesh:** We load `Soldier.glb`, parent it to `swayRoot`, and position it *behind and below* the camera. Only the arms stretch forward into the frustum.
3. **Weapon Attachment:** The weapon is not parented to the camera. It is explicitly attached to the `mixamorig:RightHand` bone of the viewmodel using `attachToBone()`.
4. **Procedural Animation:** As the player moves the mouse, `swayRoot` slightly lags behind (mouse inertia sway). When the player walks, `swayRoot` oscillates using a sine wave (view bobbing). This stacks on top of the model's skeletal `Idle` animation.

### 4.2 Enemy Bots
Enemy bots are a hybrid of physics and visual meshes:
1. A Havok Physics Capsule acts as the root. It handles ground collision and takes damage (knockback impulses from bullets).
2. The `Soldier.glb` visual mesh is instantiated and parented to the capsule, slightly offset downwards so the feet touch the bottom of the capsule.
3. The visual mesh plays embedded skeletal animations (e.g., `Idle`, `Walk`, `Run`) independently of the physics simulation.

## 5. Multiplayer Architecture & WebSockets

Instead of traditional REST APIs (which are too slow due to HTTP connection overhead), the game uses a persistent **WebSocket** connection for real-time bidirectional communication between the browser clients and the Go server.

### 5.1 Client-Side Prediction (The Browser)
- The Babylon.js render loop (`scene.onBeforeRenderObservable`) runs as fast as the monitor refresh rate (e.g., 60-144 FPS).
- Every frame, it reads keyboard/mouse inputs and immediately moves the local player's camera and physics body. This is called **Client-Side Prediction** and ensures the game feels instantly responsive without waiting for server confirmation.
- At the end of the frame (or at a fixed network rate), the client sends a small JSON object containing position, rotation, and current animation state over the WebSocket to the server.

### 5.2 Server Tick Rate (60 Hz)
- The Go backend receives these JSON packets and stores the latest known state of all players in a central map in memory.
- A Go `ticker` runs exactly **60 times per second (60 Hz)**.
- At every tick (every 16.6ms), the server compiles a snapshot of the entire world (all player states) into one JSON packet and broadcasts it down the WebSocket to every connected client.

### 5.3 Client Entity Interpolation
- When the client receives the 60 Hz broadcast, it ignores its own data (since it's predicting locally).
- It reads the data for all other players and updates the positions, rotations, and animations of their "dummy" meshes. 
- (Future enhancement: The client should interpolate/lerp between the received network snapshots rather than snapping to coordinates instantly, to smooth out network jitter).

## 6. Robust Input Architecture

### 6.1 Bypassing the HTML DOM
When building a web-based FPS, relying on raw HTML DOM events (`canvas.addEventListener('mousedown')`) is fundamentally fragile. Depending on the browser, operating system, or whether the `Pointer Lock API` is actively engaged, the browser may eat `mousedown` or `pointerdown` events for internal drag-and-drop or gesture recognition.

### 6.2 `scene.onPointerObservable`
To guarantee 100% input reliability, we bypass the DOM entirely and hook directly into Babylon.js's internal WebGL event loop:
```typescript
scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
        if (pointerInfo.event.button === 0) fireWeapon();
    }
});
```
This ensures that if a physical click occurs while the game is focused, the WebGL context registers it before the browser has a chance to suppress it.

## 7. Networked Physics (Grenades)

### 7.1 The Synchronization Strategy
When a local player throws a grenade (pressing 'G'), the client computes a precise mathematical throw vector based on the camera's forward direction. Instead of just simulating this locally, the client serializes the starting XYZ coordinates and the XYZ velocity vector into a `ThrowGrenadeEvent` Protocol Buffer.

### 7.2 Deterministic Physics 
The Go server receives this packet and instantly broadcasts it to all other players in the room as a `ServerThrowGrenadeEvent`.
When remote clients receive this event, they spawn a physical sphere exactly at the provided XYZ coordinates and apply the exact XYZ velocity vector via Havok's `applyImpulse`.

Because the Havok physics engine is highly deterministic across clients, instantiating the object with identical starting conditions guarantees that the grenade will fly through the air, bounce off walls, and land in the exact same spot for every single player, completely eliminating the need to sync the grenade's position 60 times a second.
