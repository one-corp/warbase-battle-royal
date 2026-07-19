# 🏃 Movement System Blueprint

> Realistic FPS movement mechanics — Bullet Force / COD Mobile feel with Havok physics.

---

## 1. Movement States & Speeds

### 1.1 State Table

| State | Speed (m/s) | Base Multiplier | Camera Height (Y) | Can Fire | Can ADS |
|-------|-------------|-----------------|-------------------|----------|---------|
| **Idle** | 0 | — | 1.7m | ✅ | ✅ |
| **Walk (Forward/Strafe)** | 4.5 | 1.0× | 1.7m | ✅ | ✅ |
| **Walk (Backward)** | 2.7 | 0.6× | 1.7m | ✅ | ✅ |
| **Sprint** | 5.5 | 1.22× | 1.7m | ❌ | ❌ |
| **Crouch Idle** | 0 | — | 1.0m | ✅ | ✅ |
| **Crouch Walk** | 2.0 | 0.44× | 1.0m | ✅ | ✅ |
| **ADS Walk** | 2.5 | 0.55× | 1.7m | ✅ | ✅ |
| **Airborne** | (preserves) | — | 1.7m | ✅ (reduced accuracy) | ❌ |

> **Note:** Bullet Force does NOT have prone or slide. We skip those for authenticity.

### 1.2 Weapon Weight Impact

The equipped weapon modifies base walk speed:

| Weapon Category | Move Speed Multiplier |
|-----------------|----------------------|
| SMG / Pistol | 1.0× |
| Assault Rifle | 0.95× |
| Shotgun | 0.90× |
| Sniper / LMG | 0.85× |
| Knife (melee) | 1.05× |

**Final speed** = `baseSpeed × stateMult × weaponMult`

---

## 2. Movement State Machine

```
                    ┌──────────────┐
         ┌─────────│   Airborne   │←────────┐
         │         └──────┬───────┘         │
         │ land           │ land            │ jump
         ▼                ▼                 │
    ┌─────────┐     ┌──────────┐     ┌──────────┐
    │  Idle   │────→│   Walk   │────→│  Sprint  │
    └────┬────┘     └────┬─────┘     └──────────┘
         │               │               ↑
         │ crouch    crouch│          shift+W
         ▼               ▼
    ┌──────────┐   ┌────────────┐
    │Crouch Idle│──→│Crouch Walk │
    └──────────┘   └────────────┘
```

### Transition Rules

| From | To | Trigger | Duration |
|------|----|---------|----------|
| Idle → Walk | Any WASD input | Instant (with acceleration) |
| Walk → Sprint | Hold Shift + W (forward only) | 0.1s |
| Sprint → Walk | Release Shift OR release W | 0.15s decel |
| Sprint → Fire | Press Fire (cancels sprint) | Instant transition to Walk Speed + Firing Walk anim |
| Walk → Crouch Walk | Press C | 0.2s (camera lerp) |
| Crouch → Stand | Press C | 0.2s (with ceiling check) |
| Any → Airborne | Space (or fall off edge) | Instant |
| Airborne → Idle/Walk | Contact ground | Instant (with landing) |
| Moving → Firing Walk | Press Fire while moving | Plays 'firing walk' animation |
| Standing → Firing | Press Fire while standing | Plays 'firing' animation |

---

## 3. Physics-Based Character Controller

### 3.1 Architecture: Capsule + Havok

The game uses a Havok physics capsule for the player controller. This allows the player to correctly interact with elevators, jump pads, explosions, and dynamic objects in the scene.
```typescript
// Character capsule (invisible — camera is parented to it)
const playerMesh = MeshBuilder.CreateCapsule("player", {
    height: 1.8,
    radius: 0.4,
}, scene);
playerMesh.isVisible = false; // The camera renders the world; we don't see our own body

const playerAggregate = new PhysicsAggregate(
    playerMesh,
    PhysicsShapeType.CAPSULE,
    { mass: 80, friction: 0.5, restitution: 0 },
    scene
);

// Lock rotation so capsule stays upright
playerAggregate.body.setMassProperties({
    inertia: Vector3.ZeroReadOnly // Prevents tipping
});

// Parent camera to capsule
camera.parent = playerMesh;
camera.position = new Vector3(0, 0.7, 0); // Eye height from capsule center
```

### 3.2 ECS Movement System

Movement is fully handled within `PlayerMovementSystem.ts` using the bitECS architecture to ensure top-tier efficiency. The system processes player input, calculates target velocities (including backward walk reduction and sprint modifiers), applies ground/air acceleration, and updates the Havok physics body's linear velocity each frame.

---

## 4. Sprint System

### 4.1 Stamina

| Parameter | Value |
|-----------|-------|
| Max Stamina | 100 |
| Depletion Rate | 12 units/second |
| Regeneration Rate | 10 units/second |
| Sprint Duration | ~8 seconds continuous |
| Regen Delay After Depletion | 0.5 seconds |
| Minimum Stamina to Re-sprint | 20 units |

### 4.2 Sprint Constraints

- Can only sprint **forward** (W key must be pressed)
- Cannot sprint while crouching, ADS, reloading, or firing
- Attempting to fire auto-cancels sprint → 0.1s delay → then fires
- Releasing Shift or W exits sprint

### 4.3 Sprint Camera FOV

```typescript
const baseFOV = 75;       // degrees
const sprintFOVBoost = 8; // degrees
const fovLerpSpeed = 6;   // per second

// Each frame:
const targetFOV = isSprinting ? baseFOV + sprintFOVBoost : baseFOV;
camera.fov = Scalar.Lerp(camera.fov, targetFOV * DEG2RAD, fovLerpSpeed * dt);
```

### 4.4 UI — Stamina Bar (Optional)

Small bar above health, only visible when stamina < 100%.

---

## 5. Jump System

### 5.1 Physics Values

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Gravity** | -15.328 m/s² | Increased from 9.81 to drop floatiness by 20% |
| **Jump Impulse** | 5.0 m/s upward | Slightly higher than previous 4.375 to boost max jump height |
| **Jump Height** | ~0.81m | Taller jump while maintaining the fast 20% arc |
| **Air Control** | 30% of ground accel | Slight trajectory adjustment |
| **Jump Cooldown** | 150ms after landing | Prevents bunny hopping |

### 5.2 Jump Height Formula

$$v_0 = \sqrt{2 \cdot |g| \cdot h} = \sqrt{2 \times 15.328 \times 0.81} \approx 5.0 \text{ m/s}$$

### 5.3 Implementation

```typescript
function tryJump() {
    if (!isGrounded || jumpCooldownTimer > 0) return;

    // Apply upward impulse
    const vel = playerBody.getLinearVelocity();
    playerBody.setLinearVelocity(new Vector3(vel.x, jumpImpulse, vel.z));

    isGrounded = false;
    jumpCooldownTimer = 0.15; // 150ms cooldown
}
```

### 5.4 Ground Detection

```typescript
function updateGroundState() {
    const start = playerMesh.position.clone();
    const end = start.add(new Vector3(0, -1.1, 0)); // Slightly below capsule bottom

    const result = new PhysicsRaycastResult();
    scene.getPhysicsEngine()!.raycastToRef(start, end, result);

    const wasGrounded = isGrounded;
    isGrounded = result.hasHit;

    // Landing event
    if (!wasGrounded && isGrounded) {
        onLanding();
    }

    // Coyote time: allow jump for 100ms after walking off edge
    if (wasGrounded && !isGrounded && verticalVelocity <= 0) {
        coyoteTimer = 0.1;
    }
}
```

### 5.5 Bunny Hop Prevention

On landing:
1. Clamp horizontal speed to max walk speed
2. Re-apply full ground friction
3. Start 150ms jump cooldown timer

---

## 6. Crouch System

### 6.1 Capsule Resize

| State | Capsule Height | Capsule Radius | Camera Y Offset |
|-------|---------------|----------------|-----------------|
| Standing | 1.8m | 0.4m | +0.7m from center |
| Crouching | 1.0m | 0.4m | +0.3m from center |

### 6.2 Stand-Up Check

Before uncrouching, verify there's headroom:

```typescript
function canStandUp(): boolean {
    const start = playerMesh.position.clone();
    const end = start.add(new Vector3(0, 0.9, 0)); // Check upward

    const result = new PhysicsRaycastResult();
    scene.getPhysicsEngine()!.raycastToRef(start, end, result);

    return !result.hasHit; // Can stand if nothing above
}
```

### 6.3 Smooth Camera Transition

```typescript
const standCamY = 0.7;
const crouchCamY = 0.3;
const crouchLerpSpeed = 10;

// Each frame:
const targetY = isCrouching ? crouchCamY : standCamY;
camera.position.y = Scalar.Lerp(camera.position.y, targetY, crouchLerpSpeed * dt);
```

### 6.4 Toggle vs Hold

- **Default:** Toggle (press C to crouch, press C again to stand)
- **Option:** Hold (crouch while C is held, stand on release)

---

## 7. Acceleration & Deceleration

### 7.1 Movement Feel

Instant velocity changes feel robotic. Use acceleration curves:

| Parameter | Ground | Air | Notes |
|-----------|--------|-----|-------|
| **Acceleration** | 40 m/s² | 12 m/s² | ~0.11s to full speed on ground |
| **Deceleration** | 55 m/s² | 5 m/s² | Snappier stops than starts |
| **Sprint Accel** | 30 m/s² | — | Slightly slower ramp to sprint |

### 7.2 Helper Function

```typescript
function moveTowards(current: number, target: number, maxDelta: number): number {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
}
```

### 7.3 Why Decel > Accel

- Faster deceleration = player stops crisply when releasing keys
- Slower acceleration = slight "weight" when starting to move
- This creates the "responsive but grounded" feel of COD/Bullet Force

---

## 8. Camera & Mouse Look

### 8.1 Sensitivity

```typescript
const baseSensitivity = 0.002;  // radians per pixel of mouse movement
// User-adjustable via settings slider (0.5× to 3.0×)

let yaw = 0;   // Horizontal rotation (unlimited)
let pitch = 0; // Vertical rotation (clamped)

function applyCameraRotation(dt: number) {
    const sens = baseSensitivity * userSensMultiplier;
    
    // ADS reduces sensitivity proportionally to FOV change
    const adsMult = isADS ? (adsFOV / baseFOV) : 1.0;
    
    yaw += inputState.mouseDeltaX * sens * adsMult;
    pitch -= inputState.mouseDeltaY * sens * adsMult;
    
    // Clamp pitch to prevent camera flip
    pitch = Math.max(-89 * DEG2RAD, Math.min(89 * DEG2RAD, pitch));
    
    // Apply to player mesh (yaw) and camera (pitch)
    playerMesh.rotation.y = yaw;
    camera.rotation.x = pitch;
    
    // Consume mouse delta
    inputState.mouseDeltaX = 0;
    inputState.mouseDeltaY = 0;
}
```

### 8.2 Key Principles

- **No mouse acceleration** — raw 1:1 mapping for competitive play
- **No mouse smoothing** for keyboard/mouse (add optional smoothing for gamepad)
- **Separate X/Y sensitivity** option (some players prefer different ratios)
- Use `event.movementX/Y` from Pointer Lock API (already raw input)

---

## 9. Cinematic Head Bobbing (Battlefield 6 Style)

### 9.1 The Problem with Standard Bobbing

Traditional FPS head bobbing bounces the camera rapidly up and down like a pogo stick. This causes motion sickness and feels disconnected from human locomotion.

### 9.2 Battlefield 6 Cinematic Weight Shift

Instead of just vertical bouncing, we simulate the complex transfer of human weight from foot to foot:
1. **Vertical Bob (Sine Wave):** Slight dip when stepping.
2. **Horizontal Weight Shift (Cosine Wave):** The body sways left and right as weight transfers to each leg.
3. **Camera Roll (Head Tilt):** A tiny fraction of Z-axis rotation to mimic neck tilt during heavy steps.

### 9.3 Implementation

```typescript
// Cinematic Head Bob (Battlefield style weight shifting)
if (isGrounded && localDir.length() > 0) {
    const freq = isSprinting ? 2.8 : 2.0;
    const ampY = isSprinting ? 0.012 : 0.006;
    const ampX = isSprinting ? 0.010 : 0.005;
    const ampRoll = isSprinting ? 0.005 : 0.002;
    const time = performance.now() * 0.001;
    
    // Vertical bob (sine wave)
    camera.position.y += Math.sin(time * Math.PI * 2 * freq) * ampY;
    
    // Horizontal weight shift (side-to-side step)
    camera.position.x = Math.cos(time * Math.PI * freq) * ampX;
    
    // Slight camera roll (head tilt)
    camera.rotation.z = Math.cos(time * Math.PI * freq) * ampRoll;
} else {
    // Return to center smoothly when stopping
    camera.position.x = Scalar.Lerp(camera.position.x, 0, 10 * dt);
    camera.rotation.z = Scalar.Lerp(camera.rotation.z, 0, 10 * dt);
}
```

### 9.4 Best Practices

- **Subtlety is critical** — if the player consciously notices the bob, it's too much
- Scale amplitude by actual velocity (zero bob when stopped)
- Apply to **weapon viewmodel** as well (slightly offset timing for depth)

---

## 10. Weapon Sway

### 10.1 Three Sway Layers

```
Layer 1: Mouse Inertia Sway    — weapon lags behind camera rotation
Layer 2: Movement Bob          — weapon bobs in sync with walk/run cycle
Layer 3: Idle Breathing         — slow, continuous micro-sway
```

### 10.2 Mouse Inertia Sway

```typescript
let swayX = 0;
let swayY = 0;
const swayAmount = 0.002;
const swaySmooth = 6;
const swayMaxAngle = 5 * DEG2RAD;

function updateWeaponSway(dt: number) {
    // Target sway from mouse input
    const targetX = -inputState.mouseDeltaX * swayAmount;
    const targetY = -inputState.mouseDeltaY * swayAmount;

    // Smooth lerp
    swayX = Scalar.Lerp(swayX, targetX, swaySmooth * dt);
    swayY = Scalar.Lerp(swayY, targetY, swaySmooth * dt);

    // Clamp
    swayX = Scalar.Clamp(swayX, -swayMaxAngle, swayMaxAngle);
    swayY = Scalar.Clamp(swayY, -swayMaxAngle, swayMaxAngle);

    // Apply to weapon mesh rotation
    weaponMesh.rotation.y = swayX;
    weaponMesh.rotation.x = swayY;
}
```

### 10.3 ADS Sway Reduction

While aiming down sights, reduce sway by 60–80%:
```typescript
const adsMult = isADS ? 0.3 : 1.0;
swayX *= adsMult;
swayY *= adsMult;
```

---

## 11. Fall Damage

### 11.1 Velocity-Based Calculation

```typescript
function onLanding() {
    const impactSpeed = Math.abs(verticalVelocityAtImpact);

    const safeSpeed = 10;   // No damage below this (normal jumps)
    const lethalSpeed = 25; // Instant death above this
    const maxDamage = 100;

    if (impactSpeed <= safeSpeed) return; // No damage

    if (impactSpeed >= lethalSpeed) {
        applyDamage(maxDamage);
    } else {
        const t = (impactSpeed - safeSpeed) / (lethalSpeed - safeSpeed);
        applyDamage(Math.round(t * maxDamage));
    }
}
```

### 11.2 Height Reference

With gravity = 15.328 m/s²:

| Fall Height | Impact Speed | Damage |
|-------------|-------------|--------|
| 1.2m (jump) | ~6.0 m/s | 0 |
| 3m | ~9.6 m/s | 0 |
| 5m | ~12.4 m/s | ~16 |
| 8m | ~15.7 m/s | ~38 |
| 12m | ~19.2 m/s | ~61 |
| 18m+ | ~23.5 m/s | **Death** |

---

## 12. Step Climbing & Terrain

### 12.1 Approach

Use a combination of **capsule collider** (rounded bottom naturally handles small bumps) and **downward raycast** for ground snapping.

| Parameter | Value |
|-----------|-------|
| Max Step Height | 0.35m |
| Slope Limit | 45° |
| Ground Snap Distance | 0.15m |

### 12.2 Implementation

```typescript
// For stairs: cast a ray forward at shin height
const forwardRay = new Ray(
    playerMesh.position.add(new Vector3(0, 0.2, 0)), // Shin height
    moveDirection,
    0.5
);
const forwardHit = scene.pickWithRay(forwardRay);

if (forwardHit?.hit) {
    // Something blocking at shin height — try step up
    const stepRay = new Ray(
        playerMesh.position.add(moveDirection.scale(0.5)).add(new Vector3(0, 0.5, 0)),
        Vector3.Down(),
        0.5
    );
    const stepHit = scene.pickWithRay(stepRay);

    if (stepHit?.hit && stepHit.pickedPoint) {
        const stepHeight = stepHit.pickedPoint.y - playerMesh.position.y;
        if (stepHeight > 0 && stepHeight <= maxStepHeight) {
            // Smoothly raise player to step
            playerMesh.position.y = Scalar.Lerp(playerMesh.position.y, stepHit.pickedPoint.y, 10 * dt);
        }
    }
}
```

### 12.3 Level Design Tip

For guaranteed smooth stair traversal, place **invisible ramp collision meshes** over stair geometry. The visual stays as stairs; the physics uses a smooth slope.

---

## 13. Input System Architecture

### 13.1 ECS Input Pattern
Input is decoupled from game logic using bitECS. The browser's DOM event listeners update the `InputComponent` arrays (e.g., `InputComponent.forward[eid] = 1`). 
Game systems like the `PlayerMovementSystem` simply read these component values each frame without relying on event callbacks or object-oriented state tracking.

---

## 14. Gravity & Physics Constants

### 14.1 Master Constants

```typescript
// Physics
const GRAVITY = -15.328;          // m/s² (snappier than real 9.81, 20% faster arc)
const JUMP_IMPULSE = 5.0;         // m/s (gives ~0.81m height)
const PLAYER_MASS = 80;           // kg
const CAPSULE_HEIGHT = 1.8;       // meters
const CAPSULE_RADIUS = 0.4;       // meters

// Movement speeds (m/s)
const WALK_SPEED = 4.5;
const SPRINT_SPEED = 5.5;
const CROUCH_SPEED = 2.0;
const ADS_SPEED = 2.5;

// Acceleration (m/s²)
const GROUND_ACCEL = 40;
const GROUND_DECEL = 55;
const AIR_ACCEL = 12;
const AIR_DECEL = 5;

// Sprint
const MAX_STAMINA = 100;
const STAMINA_DRAIN = 12;         // per second
const STAMINA_REGEN = 10;         // per second
const STAMINA_REGEN_DELAY = 0.5;  // seconds after depletion
const MIN_STAMINA_TO_SPRINT = 20;

// Jump
const JUMP_COOLDOWN = 0.15;       // seconds
const COYOTE_TIME = 0.1;          // seconds
const MAX_AIR_CONTROL = 0.3;      // 30% of ground accel

// Crouch
const CROUCH_HEIGHT = 1.0;        // meters
const CROUCH_LERP_SPEED = 10;     // units/second

// Camera
const BASE_FOV = 75;              // degrees
const SPRINT_FOV_BOOST = 8;       // degrees
const FOV_LERP_SPEED = 6;         // per second

// Fall damage
const SAFE_FALL_SPEED = 10;       // m/s
const LETHAL_FALL_SPEED = 25;     // m/s

// Step climbing
const MAX_STEP_HEIGHT = 0.35;     // meters
const MAX_SLOPE_ANGLE = 45;       // degrees

// Mouse
const BASE_SENSITIVITY = 0.002;   // radians per pixel
const PITCH_LIMIT = 89;           // degrees
```



## 17. Networked Animation Architecture (Multiplayer)

A common question in FPS development is: *"If my viewmodel just floats in front of the camera and plays the Idle animation, how do other players see me running and walking?"*

### 17.1 The Decoupled Model Approach
We solve this using standard AAA multiplayer decoupling:

1. **Local Player (Client)**
   - Renders the **Viewmodel** (Arms + Weapon).
   - The viewmodel is parented to the camera.
   - It plays the `Idle` skeletal animation 100% of the time (for breathing).
   - "Movement" is simulated via procedural math (Sine wave view-bobbing, mouse inertia sway).
   - The full-body player mesh is **invisible** to the local camera.

2. **Network Data Stream**
   - The client sends its physical velocity vector (e.g., `Vx = 4.0, Vz = 2.0`), position, and rotation (Yaw) to the server.

3. **Remote Players (Other Clients)**
   - They receive your velocity and position.
   - They do **not** render your viewmodel.
   - Instead, they render your **Full-Body Model** (`Soldier.glb`).
   - They calculate your true physical speed (`Math.sqrt(Vx*Vx + Vz*Vz)`).
   - They use **Animation Blending** (see Section 18) to seamlessly transition your Full-Body Model from `Idle` to `Walk` to `Run` based on your speed.

---

## 18. Dynamic Animation Blending (Bot AI)

Instead of instantly snapping a character from an Idle pose into a Walk cycle, we continuously run multiple animations simultaneously and adjust their "Weight" (opacity) based on physical physics velocity.

### 18.1 Blending Math
```typescript
// Calculate physical speed from Havok physics body
const currentVel = aggregate.body.getLinearVelocity();
const currentSpeed = Math.sqrt(currentVel.x * currentVel.x + currentVel.z * currentVel.z);

// Normalize speed to a 0.0 -> 1.0 weight
const maxWalkSpeed = 2.5;
const walkWeight = Math.min(currentSpeed / maxWalkSpeed, 1.0);

// Blend weights seamlessly
idleAnim.setWeightForAllAnimatables(1.0 - walkWeight);
walkAnim.setWeightForAllAnimatables(walkWeight);
```

### 18.2 Why Blending?
- **No Sliding:** The legs pump exactly as fast as the capsule moves.
- **Micro-Movements:** If the bot takes a tiny step, the animation only slightly leans into the walk cycle before settling back to idle.
- **Momentum:** As the Havok physics capsule accelerates and decelerates due to friction, the animations perfectly follow that momentum curve.

---

## 19. Multiplayer Animation Sync & State Management

### 19.1 Network Tick Restarts (The Floating Bug)
When broadcasting player state over the network (e.g., at 30Hz), you receive the animation state (e.g., `"run"`) 30 times a second.

**CRITICAL BUG:** If the client naively calls `animation.start()` every time it receives a state update, the animation will restart from Frame 0 every 33 milliseconds. This results in the character appearing to float or drag across the ground without moving their legs!

### 19.2 The Fix: State Tracking
The client *must* track the currently playing animation state for each remote player and only trigger `.start()` when the state *changes*.

```typescript
// Inside network onStateReceived loop:
const networkAnim = newState.anim || "idle";

// Only switch animations if the requested animation changed
if (player.currentState !== networkAnim) {
    // Stop current animations
    for (const name in player.anims) {
        player.anims[name].stop();
    }

    // Try exact match, or fallback to includes
    for (const name in player.anims) {
        if (name.toLowerCase().includes(networkAnim.toLowerCase())) {
            player.anims[name].start(true, 1.0, player.anims[name].from, player.anims[name].to, false); 
            break;
        }
    }
    
    // Update local tracker
    player.currentState = networkAnim;
}
```

### 19.3 Camera Yaw vs Mesh Forward
Standard 3D models (like the Mixamo `Soldier.glb`) typically default to facing the `-Z` axis (towards the camera). However, the Babylon.js `UniversalCamera` looks down the `+Z` axis.
To ensure the remote player's model faces the correct direction they are looking, a `Math.PI` (180-degree) offset must be applied to the Yaw rotation before broadcasting it to the network server.

### 19.4 Global Animation Blending (Smooth Transitions)
When transitioning between animations (e.g., Idle -> Run), instantly playing the new animation can cause harsh snaps or jittering if the previous animation's weights aren't cleared properly.

To achieve mathematically smooth crossfades between animations, Babylon.js requires two things:
1. **Global Override**: A scene-wide `AnimationPropertiesOverride` to instruct the engine to blend all animations globally.
```typescript
const override = new AnimationPropertiesOverride();
override.enableBlending = true;
override.blendingSpeed = 0.05; // ~20 frames of smooth interpolation
scene.animationPropertiesOverride = override;
```
2. **Proper `stop()` Calls**: When triggering a new animation state, the current animation MUST be explicitly stopped:
```typescript
currentAnimation.stop();
newAnimation.start();
```
When `stop()` is called with global blending enabled, Babylon freezes the skeleton in its exact current frame/pose, and uses that pose as the starting point to smoothly lerp into the first frame of `newAnimation`. If you fail to call `stop()`, both animations will evaluate simultaneously and fight for bone control, breaking the blend.
