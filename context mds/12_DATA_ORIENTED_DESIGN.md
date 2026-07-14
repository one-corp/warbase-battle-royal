# Data-Oriented Design (DOD) & ECS

This project utilizes Data-Oriented Design principles and the `bitecs` Entity Component System to manage entities that spawn and die frequently, ensuring a stutter-free 60 FPS experience by eliminating Garbage Collection (GC) spikes.

> [!IMPORTANT]
> We use `bitecs@0.3.40` to ensure a stable, typed API (`defineComponent`, `defineQuery`). Avoid upgrading to `v0.4.x` as it introduces breaking API changes that remove explicit component definition tracking.

## The Garbage Collection Problem
In classic Object-Oriented game loops, firing a bullet creates a new `Mesh` object. When it hits a wall, it is `dispose()`'d. This continuous memory allocation and deallocation triggers the V8 Javascript Garbage Collector, freezing the main thread for 10-50ms (a massive stutter).

## The ECS Solution
We implement a strict Structure of Arrays (SoA) ECS.
- **Entities** are just integer IDs.
- **Components** are backed by highly optimized `Float32Array` or `Uint8Array` memory buffers.
- **Systems** operate purely on the data arrays, providing maximum CPU cache locality.

### Architecture Structure
The engine core is located in `client/src/ecs`:

#### 1. Components (`Components.ts`)
Instead of objects, we define plain flat arrays.
```typescript
export const Position = defineComponent({
    x: Types.f32,
    y: Types.f32,
    z: Types.f32,
});
```
This guarantees contiguous memory allocation. Looking up a position is just `Position.x[entityId]`.

#### 2. ViewMaps (`ViewMaps.ts`)
In a pure ECS, systems must never touch Babylon objects. We use `ViewMaps` to bridge the gap.
```typescript
export const entityMeshes = new Map<number, Mesh>();
export const entityPhysicsBodies = new Map<number, PhysicsBody>();
export const entityCameras = new Map<number, UniversalCamera>();
```
The logic systems do pure math on the components. The Render/Physics synchronization systems use the Entity ID to look up the Babylon object in the Map and apply the data.

#### 3. Systems (`systems/`)
Logic is broken into discrete update loops run every frame:
- **`PlayerSystem.ts`**: Maps browser DOM input events directly to the `InputComponent` binary flags.
- **`PlayerMovementSystem.ts`**: Pure math. Reads inputs, calculates forces, manages jump cooldowns, and writes to `Velocity` and `Position`.
- **`PhysicsSystem.ts`**: Reads transforms from the Havok `PhysicsBody` and syncs them back into the ECS `Position` arrays.
- **`RenderSystem.ts`**: Syncs the ECS `Position` and `Rotation` arrays to the visual Babylon `Mesh`.

### Player Architecture Rewrite
The legacy OOP `PlayerController.ts` class was completely removed. 
The player is now just an Entity ID (`playerEid`). `MainScene.ts`, `WeaponSystem.ts`, and `NetworkManager.ts` query the data arrays (e.g. `InputComponent.forward[playerEid]`) rather than reading from a central class instance.

### Object Pooling for VFX
For dynamic visual effects (Decals/Bullet Holes and Tracers), we pre-allocate the maximum number of entities at startup (e.g., 50 Decals, 20 Tracers) in `DecalSystem.ts` and `TracerSystem.ts`.

When a bullet hits a wall:
1. We do **not** instantiate a new `Mesh`.
2. We grab the next available ECS `EntityID` from our ring buffer pool.
3. We overwrite the `Position` components.
4. The mesh becomes instantly visible at the new location without any memory allocation.

### Networking Benefits
By keeping game state inside `Float32Array` and `Uint8Array` structures, serializing game state for the multiplayer Go server becomes incredibly cheap. We can bypass heavy JSON stringification and potentially send binary buffers directly over WebSockets in the future.
