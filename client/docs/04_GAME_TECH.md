# Game Tech & Engine Architecture

This document tracks technical decisions, engine configurations, and architectural learnings while building the FPS game in Babylon.js.

## 1. Engine Initialization (WebGL 2 vs WebGPU)

### 1.1 The WebGPU Crash with Skeletal Animations
Babylon.js 6.0+ introduced the `WebGPUEngine`, which offers significant performance improvements over traditional WebGL in terms of draw calls and compute shaders. The project was initially bootstrapped using `WebGPUEngine`.

However, integrating `Soldier.glb` caused a silent, catastrophic crash resulting in a pitch-black screen.

**The Cause:**
- `Soldier.glb` relies heavily on Skeletal Animations (bone skinning).
- When Babylon's WebGPU pipeline attempts to compile the shaders for complex bone weights and indices without explicit buffer configurations or limits, it can fail a `GPUValidationError`.
- The exact uncaptured error log was: `[Invalid RenderPipeline "RenderPipeline_bgra8unorm_depth24plus-stencil8_samples4_textureState1"] is invalid due to a previous error.`
- Because `WebGPUEngine.initAsync()` failed to build the RenderPipeline for the soldier, the entire render loop was halted.

### 1.2 The WebGL 2 Solution
To guarantee stability across all devices and avoid experimental WebGPU validation errors with rigged GLTF models, we reverted to the highly stable **WebGL 2 Engine**.

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
