# 🏃 Movement System Blueprint

> Realistic FPS movement mechanics — Bullet Force / COD Mobile feel with Havok physics.

---

## 1. Movement States & Speeds

### 1.1 State Table

| State | Speed (m/s) | Base Multiplier | Camera Height (Y) | Can Fire | Can ADS |
|-------|-------------|-----------------|-------------------|----------|---------|
| **Idle** | 0 | — | 1.7m | ✅ | ✅ |
| **Walk** | 4.5 | 1.0× | 1.7m | ✅ | ✅ |
| **Sprint** | 6.5 | 1.44× | 1.7m | ❌ | ❌ |
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

### 3.1 Why Replace the Current System

The current prototype uses `UniversalCamera.checkCollisions` — this is Babylon's **legacy collision system**, not actual physics. It:
- Doesn't interact with Havok physics bodies
- Has poor step-climbing behavior
- Can't apply impulses (explosions, knockback)
- Gravity/jumping is hacked with manual position offsets

### 3.2 Recommended Architecture: Capsule + Havok

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

### 3.3 Movement Loop

```typescript
scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;

    // 1. Read input state
    const inputDir = getInputDirection(); // Normalized WASD vector in camera space

    // 2. Determine target speed
    let targetSpeed = walkSpeed;
    if (isSprinting && inputDir.z > 0) targetSpeed = sprintSpeed;
    if (isCrouching) targetSpeed = crouchSpeed;
    if (isADS) targetSpeed = adsSpeed;
    targetSpeed *= weaponSpeedMult;

    // 3. Calculate target velocity (world space)
    const forward = camera.getDirection(Vector3.Forward());
    const right = camera.getDirection(Vector3.Right());
    forward.y = 0; forward.normalize();
    right.y = 0; right.normalize();

    const targetVelocity = forward.scale(inputDir.z)
        .add(right.scale(inputDir.x))
        .normalize()
        .scale(targetSpeed);

    // 4. Apply acceleration/deceleration
    const currentVel = playerAggregate.body.getLinearVelocity();
    const accel = isGrounded ? groundAccel : airAccel;
    const newVelX = moveTowards(currentVel.x, targetVelocity.x, accel * dt);
    const newVelZ = moveTowards(currentVel.z, targetVelocity.z, accel * dt);

    // 5. Preserve vertical velocity (gravity handled by Havok)
    playerAggregate.body.setLinearVelocity(new Vector3(newVelX, currentVel.y, newVelZ));

    // 6. Ground detection
    updateGroundState();

    // 7. Camera rotation (mouse look)
    applyCameraRotation(dt);
});
```

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
| **Gravity** | -18 m/s² | Snappier than real (9.81). Tuned for game feel |
| **Jump Impulse** | 6.6 m/s upward | Gives ~1.2m jump height |
| **Jump Height** | ~1.2m | Enough to jump on crates/low walls |
| **Air Control** | 30% of ground accel | Slight trajectory adjustment |
| **Jump Cooldown** | 150ms after landing | Prevents bunny hopping |

### 5.2 Jump Height Formula

$$v_0 = \sqrt{2 \cdot |g| \cdot h} = \sqrt{2 \times 18 \times 1.2} \approx 6.6 \text{ m/s}$$

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

## 9. Head Bobbing

### 9.1 Values

| State | Vertical Amplitude | Horizontal Amplitude | Frequency (Hz) |
|-------|-------------------|---------------------|-----------------|
| Walk | 0.04m | 0.02m | 2.5 |
| Sprint | 0.07m | 0.04m | 4.0 |
| Crouch Walk | 0.02m | 0.01m | 2.0 |
| Idle | 0.005m | 0.003m | 0.8 (breathing) |

### 9.2 Implementation

```typescript
let bobTimer = 0;

function updateHeadBob(dt: number, speed: number) {
    if (speed < 0.1) {
        // Idle breathing
        bobTimer += dt * 0.8;
        camera.position.y += Math.sin(bobTimer * Math.PI * 2) * 0.005;
        return;
    }

    const config = isSprinting ? sprintBob : (isCrouching ? crouchBob : walkBob);
    bobTimer += dt * config.frequency;

    const vertBob = Math.sin(bobTimer * Math.PI * 2) * config.vertAmplitude;
    const horizBob = Math.cos(bobTimer * Math.PI) * config.horizAmplitude;

    // Apply as offset (don't replace camera.position, add to it)
    camera.position.y += vertBob;
    camera.position.x += horizBob;
}
```

### 9.3 Best Practices

- **Subtlety is critical** — if the player consciously notices the bob, it's too much
- Scale amplitude by actual velocity (zero bob when stopped)
- Sync bob frequency with footstep sounds
- Provide a setting to reduce or disable (accessibility)
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

With gravity = 18 m/s²:

| Fall Height | Impact Speed | Damage |
|-------------|-------------|--------|
| 1.2m (jump) | ~6.6 m/s | 0 |
| 3m | ~10.4 m/s | ~3 |
| 5m | ~13.4 m/s | ~23 |
| 8m | ~17.0 m/s | ~47 |
| 12m | ~20.8 m/s | ~72 |
| 17m+ | ~25 m/s | **Death** |

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

### 13.1 State-Poll Pattern

Decouple input events from game logic. Events only update state; the game loop reads state.

```typescript
interface InputState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    sprint: boolean;
    jump: boolean;
    crouch: boolean;
    fire: boolean;
    ads: boolean;
    reload: boolean;
    weapon1: boolean;
    weapon2: boolean;
    weapon3: boolean;
    quickSwitch: boolean;
    mouseDeltaX: number;
    mouseDeltaY: number;
}

const input: InputState = { /* all false/zero */ };

// Key bindings
const KEY_MAP: Record<string, keyof InputState> = {
    'KeyW': 'forward',
    'KeyS': 'backward',
    'KeyA': 'left',
    'KeyD': 'right',
    'ShiftLeft': 'sprint',
    'Space': 'jump',
    'KeyC': 'crouch',
    'KeyR': 'reload',
    'Digit1': 'weapon1',
    'Digit2': 'weapon2',
    'Digit3': 'weapon3',
    'KeyQ': 'quickSwitch',
};

window.addEventListener('keydown', (e) => {
    const key = KEY_MAP[e.code];
    if (key) input[key] = true;
    e.preventDefault();
});

window.addEventListener('keyup', (e) => {
    const key = KEY_MAP[e.code];
    if (key) input[key] = false;
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) input.fire = true;
    if (e.button === 2) input.ads = true;
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.fire = false;
    if (e.button === 2) input.ads = false;
});

canvas.addEventListener('mousemove', (e) => {
    input.mouseDeltaX += e.movementX;
    input.mouseDeltaY += e.movementY;
});

// Prevent right-click context menu
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
```

### 13.2 Input Direction Helper

```typescript
function getInputDirection(): Vector3 {
    let x = 0, z = 0;
    if (input.forward) z += 1;
    if (input.backward) z -= 1;
    if (input.left) x -= 1;
    if (input.right) x += 1;

    const dir = new Vector3(x, 0, z);
    if (dir.length() > 0) dir.normalize();
    return dir;
}
```

---

## 14. Gravity & Physics Constants

### 14.1 Master Constants

```typescript
// Physics
const GRAVITY = -18;              // m/s² (snappier than real 9.81)
const JUMP_IMPULSE = 6.6;         // m/s (gives ~1.2m height)
const PLAYER_MASS = 80;           // kg
const CAPSULE_HEIGHT = 1.8;       // meters
const CAPSULE_RADIUS = 0.4;       // meters

// Movement speeds (m/s)
const WALK_SPEED = 4.5;
const SPRINT_SPEED = 6.5;
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

---

## 15. Camera Shake (Events)

### 15.1 Trigger Events

| Event | Intensity | Duration | Frequency |
|-------|-----------|----------|-----------|
| Firing | 0.002 | Per shot | High |
| Landing (hard) | 0.01–0.03 | 0.3s | Low |
| Explosion nearby | 0.02–0.05 | 0.5s | Medium |
| Getting hit | 0.01 | 0.2s | Medium |

### 15.2 Implementation

```typescript
class CameraShake {
    private trauma = 0;      // 0–1, decays over time
    private decayRate = 3;

    addTrauma(amount: number) {
        this.trauma = Math.min(1, this.trauma + amount);
    }

    update(dt: number): { x: number; y: number } {
        if (this.trauma <= 0) return { x: 0, y: 0 };

        // Shake intensity = trauma² (quadratic for dramatic spikes)
        const shake = this.trauma * this.trauma;
        const t = performance.now() * 0.01;

        const offsetX = (Math.sin(t * 17.3) + Math.sin(t * 31.7)) * 0.5 * shake * 0.02;
        const offsetY = (Math.sin(t * 23.1) + Math.sin(t * 29.3)) * 0.5 * shake * 0.02;

        // Decay
        this.trauma = Math.max(0, this.trauma - this.decayRate * dt);

        return { x: offsetX, y: offsetY };
    }
}
```

---

## 16. Full Movement Update Loop (Pseudocode)

```typescript
function updateMovement(dt: number) {
    // 1. Update timers
    jumpCooldownTimer = Math.max(0, jumpCooldownTimer - dt);
    coyoteTimer = Math.max(0, coyoteTimer - dt);

    // 2. Ground check
    updateGroundState();

    // 3. Crouch toggle
    if (input.crouch && justPressed('crouch')) {
        if (isCrouching && canStandUp()) isCrouching = false;
        else if (!isCrouching) isCrouching = true;
    }

    // 4. Sprint check
    const canSprint = input.sprint && input.forward && isGrounded
        && !isCrouching && !isADS && !isReloading && stamina > MIN_STAMINA_TO_SPRINT;
    isSprinting = canSprint;

    // 5. Stamina
    if (isSprinting && isMoving) {
        stamina -= STAMINA_DRAIN * dt;
        if (stamina <= 0) { stamina = 0; isSprinting = false; }
    } else {
        stamina = Math.min(MAX_STAMINA, stamina + STAMINA_REGEN * dt);
    }

    // 6. Determine speed
    let speed = WALK_SPEED;
    if (isSprinting) speed = SPRINT_SPEED;
    if (isCrouching) speed = CROUCH_SPEED;
    if (isADS) speed = ADS_SPEED;
    speed *= weaponSpeedMult;

    // 7. Build target velocity
    const inputDir = getInputDirection();
    const targetVel = worldDirection(inputDir).scale(speed);

    // 8. Accelerate / decelerate
    const accel = isGrounded
        ? (inputDir.length() > 0 ? GROUND_ACCEL : GROUND_DECEL)
        : (inputDir.length() > 0 ? AIR_ACCEL : AIR_DECEL);
    const vel = playerBody.getLinearVelocity();
    const newX = moveTowards(vel.x, targetVel.x, accel * dt);
    const newZ = moveTowards(vel.z, targetVel.z, accel * dt);

    // 9. Jump
    let newY = vel.y;
    if (input.jump && (isGrounded || coyoteTimer > 0) && jumpCooldownTimer <= 0) {
        newY = JUMP_IMPULSE;
        isGrounded = false;
        coyoteTimer = 0;
        jumpCooldownTimer = JUMP_COOLDOWN;
    }

    // 10. Apply velocity
    playerBody.setLinearVelocity(new Vector3(newX, newY, newZ));

    // 11. Camera rotation
    applyCameraRotation(dt);

    // 12. Head bob
    updateHeadBob(dt, new Vector3(newX, 0, newZ).length());

    // 13. Crouch camera lerp
    const targetCamY = isCrouching ? CROUCH_CAM_Y : STAND_CAM_Y;
    camera.position.y = Scalar.Lerp(camera.position.y, targetCamY, CROUCH_LERP_SPEED * dt);

    // 14. Sprint FOV
    const targetFOV = isSprinting ? BASE_FOV + SPRINT_FOV_BOOST : BASE_FOV;
    camera.fov = Scalar.Lerp(camera.fov, targetFOV * DEG2RAD, FOV_LERP_SPEED * dt);

    // 15. Camera shake
    const shake = cameraShake.update(dt);
    camera.rotation.x += shake.y;
    camera.rotation.y += shake.x;
}
```

---

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
