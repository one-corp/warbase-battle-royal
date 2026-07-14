# Map Physics & Havok Dynamics

This document covers best practices and technical gotchas when implementing physics for map elements (like moving platforms, elevators, and static cover) in Babylon.js using the Havok plugin.

## Kinematic Bodies (Moving Platforms & Elevators)

When creating objects that move autonomously but need to push or carry other physics bodies (like players or physics-enabled crates), you must configure them as **Kinematic** bodies.

### 1. Motion Type
The physics aggregate must be set to `PhysicsMotionType.ANIMATED`. This tells Havok that the body is not affected by gravity or collisions, but it can still affect other dynamic bodies.

```typescript
const eleAgg = new PhysicsAggregate(elePlatform, PhysicsShapeType.BOX, { mass: 0, friction: 1.0 }, scene);
eleAgg.body.setMotionType(PhysicsMotionType.ANIMATED);
```

### 2. The `disablePreStep` Teleportation Bug
By default, Babylon.js Havok bodies have `disablePreStep = true`. **Do not set this to false for elevators.** 
Setting it to `false` forces the physics engine to synchronize the body's position to the mesh's transform every frame, which essentially *teleports* the body. Teleporting skips continuous collision checks and zeros out the velocity, causing players to fall through.

### 3. Movement using `setTargetTransform`
To make a platform push objects, Havok needs to calculate its kinematic velocity. You must move the body using `setTargetTransform(position, rotation)`.

```typescript
// Inside the render loop or animation observable
const targetY = ...; // Calculate new position

// Visually update the mesh
elePlatform.position.y = targetY;

// Physically update the body so it calculates velocity and pushes the player
if (eleAgg.body) {
    eleAgg.body.setTargetTransform(elePlatform.position, elePlatform.rotationQuaternion || new Quaternion(0,0,0,1));
}
```

### 4. The "Carry Problem" (Player Controller Velocity Override)
If your `PlayerController` manually calculates and sets `playerBody.setLinearVelocity(walkVelocity)` every frame, you will **destroy** the upward or lateral velocity the physics engine just granted you from standing on the moving platform. The player will slip off or fall through.

**The Fix:**
When calculating the player's movement, shoot a raycast down to check if the ground mesh has a `PhysicsMotionType.ANIMATED` physics body. If it does, retrieve its linear velocity and add it to your player's calculated walk velocity before applying it to the player body. Never manually reset the player's `y` velocity to `0` if you want them to ride elevators.

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

By adhering to these rules, the map environment remains physically stable, and complex interactions like working elevators function reliably in multiplayer.
