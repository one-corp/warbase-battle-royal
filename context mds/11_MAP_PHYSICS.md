# Map Physics & Havok Dynamics

This document covers best practices and technical gotchas when implementing physics for map elements (like moving platforms, elevators, and static cover) in Babylon.js using the Havok plugin.

## Moving Platforms & Elevators (Multiplayer Sync)

Previously, moving platforms were implemented using Havok's `PhysicsMotionType.ANIMATED` and `setTargetTransform`, relying on the physics engine to calculate velocities and push the player. However, in a multiplayer environment with network latency, this approach leads to heavy desynchronization, rubber-banding, and the notorious "Carry Problem."

We have replaced pure physics-driven elevators with a **Global Time + Local Space Networking** architecture.

### 1. Global Time Synchronization
Elevators are animated procedurally (e.g., using sine waves). To ensure that the elevator is in the exact same physical position on every client's screen regardless of when they joined the server, the animation time is driven by a global clock rather than a local frame delta:

```typescript
// Elevator speed synced globally
const time = Date.now() / 1000 * 0.4; 
const t = (Math.sin(time) + 1) / 2;
elePlatform.position.y = 0.25 + t * (roofY - 0.25);
```

### 2. Local Space Networking (Platform-Relative Coordinates)
Even with synchronized platforms, sending standard World Coordinates over the network causes players to float or sink on other clients due to latency (the platform moves while the packet is in transit).

**The Solution:**
1. **Client Sending:** When the local player is grounded on an elevator (detected via a downward Raycast), their World Position is transformed into the elevator's **Local Space** using the elevator's inverse World Matrix. The client transmits these local coordinates along with a `platform_id`.
2. **Server:** The Go server routes the `platform_id` alongside the spatial data in the `PlayerStateUpdate`.
3. **Client Receiving:** When a remote client receives a position update containing a `platform_id`, it interpolates the *local* coordinates, and then multiplies the result by the elevator's current World Matrix.

This mathematically guarantees that the remote player is "glued" to the moving surface, perfectly replicating AAA networking techniques for moving payloads/trains.

### 3. The Frustum Culling Trap (Disappearing Meshes)
When interpolating positions at high speeds on moving platforms using manual mathematics (e.g. `Vector3.LerpToRef`), a critical issue emerges: **Frustum Culling**.
- Babylon.js does not automatically recalculate bounding boxes for highly complex skeletal meshes every frame.
- If a remote player climbs a high platform, their visual mesh moves up, but their cached Bounding Box stays on the ground.
- If the camera pans away from the ground, Babylon thinks the player is off-screen and **un-renders** them (the mesh disappears).

**The Fix:**
Whenever manually setting the position of an interpolated player riding a platform, you must explicitly recalculate the bounding box using the new world matrix.

```typescript
// Force update world matrix and bounding boxes to prevent frustum culling disappearance
player.mesh.computeWorldMatrix(true);
player.mesh.getChildMeshes(false).forEach(m => m.refreshBoundingInfo(true, true));
```
Failure to include this step will cause remote players to vanish when standing on high platforms or fast-moving vehicles.

## Static Map Elements (Buildings & Cover)

For non-moving elements like building walls, floors, and scattered crates that should remain stationary, the setup is much simpler.

### Mass and Shape
Static objects should always have a `mass: 0`. The shape type should closely match the geometry to ensure accurate hitboxes and collisions.

```typescript
// Concrete block cover
new PhysicsAggregate(blockMesh, PhysicsShapeType.BOX, { mass: 0 }, scene);

// Lamp post pole
new PhysicsAggregate(poleMesh, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
```

### The "Walking in Air" Map Bug (Large Meshes)
When loading large, complex GLB environments (like a detailed Village or Industrial Zone map), a common mistake is attempting to optimize Havok physics by falling back to simpler shapes if the vertex count exceeds an arbitrary threshold (e.g., >60,000 vertices).

**The Problem:**
If you fallback to a `PhysicsShapeType.BOX` on an entire level mesh because it is too large, Havok generates a gigantic cubic bounding box encompassing the farthest points of the entire map. If a player spawns on the ground but is inside this bounding box, Havok will instantly eject the player to the top surface of the box. This causes the player to be stranded 50 feet in the air, seemingly "walking in the sky" above the actual map.

**The Solution:**
Havok V2 natively handles complex environment meshes. You must strictly use `PhysicsShapeType.MESH` for environment topology regardless of how high the vertex count goes:
```typescript
// CRITICAL: Always use MESH for environment geometry to perfectly trace floors/walls
if (mesh.getTotalVertices() > 0) {
    new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0, friction: 0.5, restitution: 0 }, scene);
}
```
This forces the physics engine to trace the precise triangles of the roads, stairs, and walls, ensuring players walk on the actual ground rather than a massive invisible wrapper.

By adhering to these rules, the map environment remains physically stable, and complex interactions like working elevators function reliably in multiplayer.

## Map Materials & The "Mirror Ground" Bug

When loading external GLB map environments (like `village_lowres.glb`), a common rendering issue is that the built-in PBR (Physically Based Rendering) materials often default to highly reflective settings (metallic = 1.0, roughness = 0.0) if no specific texture map is provided. When combined with an HDR environment skybox, this causes the dirt or concrete ground to look like a perfectly polished mirror.

### The Fix

To ensure map materials look like realistic terrain rather than chrome, we intercept the materials immediately after the GLB is loaded and before the scene fully renders. We iterate through the container meshes, locate any `PBRMaterial`, and forcibly reduce the `metallic` and increase `roughness` properties.

```typescript
// Example from Environment.ts: loadGLBMap()
container.meshes.forEach((mesh) => {
    if (mesh.material && mesh.material.getClassName() === "PBRMaterial") {
        const pbr = mesh.material as any;
        if (this.mapChoice === "village") {
            pbr.metallic = 0.0;
            pbr.roughness = 0.95; // Forces ground to look like matte dirt/concrete
        } else {
            // Globally tone down pure mirrors unless explicitly marked
            if (pbr.metallic > 0.8 && pbr.roughness < 0.2) {
                pbr.roughness = 0.4; 
            }
        }
    }
});
```

By flattening the PBR properties during map initialization, the rendering engine correctly shades the terrain as a diffuse surface, fixing the "mirror ground" bug without requiring manual edits to the 3D map files in Blender.
