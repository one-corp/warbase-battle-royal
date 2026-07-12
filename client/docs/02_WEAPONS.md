# 🔫 Weapons Blueprint

> Arsenal design spec for a Bullet Force–inspired web FPS — stats, modeling, mechanics, and effects.

---

## 1. Weapon Categories & Stats

All values are tuned to match Bullet Force's feel. Stats drive gameplay balance; visuals are secondary.

### 1.1 Assault Rifles

| Weapon | Damage | Headshot | RPM | Mag | Reload (s) | Range | Move Speed |
|--------|--------|----------|-----|-----|------------|-------|------------|
| **AK-47** | 34 | ×2.5 (85) | 600 | 30 | 2.5 | Long | 0.95× |
| **M4A1** | 28 | ×2.5 (70) | 800 | 30 | 2.3 | Medium-Long | 0.95× |
| **FAD** | 30 | ×2.5 (75) | 700 | 30 | 2.4 | Medium | 0.95× |

### 1.2 SMGs

| Weapon | Damage | Headshot | RPM | Mag | Reload (s) | Range | Move Speed |
|--------|--------|----------|-----|-----|------------|-------|------------|
| **MP5** | 25 | ×2.0 (50) | 900 | 44 | 2.0 | Short-Medium | 1.0× |
| **Vector** | 20 | ×2.0 (40) | 1200 | 25 | 2.0 | Short | 1.0× |

### 1.3 Snipers

| Weapon | Damage | Headshot | RPM | Mag | Reload (s) | Range | Move Speed |
|--------|--------|----------|-----|-----|------------|-------|------------|
| **AWP** | 95 | ×2.0 (190) | Bolt | 5 | 1.75 | Very Long | 0.85× |
| **M200** | 90 | ×2.0 (180) | Bolt | 10 | 2.0 | Very Long | 0.85× |

### 1.4 Shotguns

| Weapon | Damage/Pellet | Pellets | RPM | Mag | Reload (s) | Range | Move Speed |
|--------|--------------|---------|-----|-----|------------|-------|------------|
| **SAIGA** | 15 | 8 | 300 | 8 | 2.5 | Short | 0.90× |

### 1.5 Pistols (Secondary)

| Weapon | Damage | Headshot | RPM | Mag | Reload (s) | Range | Move Speed |
|--------|--------|----------|-----|-----|------------|-------|------------|
| **Desert Eagle** | 50 | ×2.0 (100) | Semi | 7 | 1.5 | Medium | 1.0× |
| **M1911** | 35 | ×2.0 (70) | Semi | 8 | 1.3 | Short-Medium | 1.0× |

### 1.6 Melee

| Weapon | Damage | Range | Speed | Move Speed |
|--------|--------|-------|-------|------------|
| **Knife** | 100 (instant kill) | 2m | 0.5s swing | 1.05× |

---

## 2. Weapon Data Architecture

All weapon configs are **data-driven** — stored as plain objects, not hardcoded logic.

```typescript
interface WeaponConfig {
    id: string;
    name: string;
    category: 'ar' | 'smg' | 'sniper' | 'shotgun' | 'pistol' | 'melee';
    slot: 'primary' | 'secondary' | 'melee';

    // Combat stats
    damage: number;
    headshotMultiplier: number;
    fireRate: number;          // rounds per minute
    fireMode: 'auto' | 'semi' | 'bolt' | 'melee';
    magSize: number;
    reserveAmmo: number;
    reloadTime: number;        // seconds (tactical)
    reloadTimeEmpty: number;   // seconds (empty mag — bolt catch)

    // Accuracy
    baseSpread: number;        // degrees
    bloomPerShot: number;      // degrees added per shot
    maxSpread: number;         // degrees cap
    bloomRecovery: number;     // degrees/second recovery

    // Recoil
    recoilVertical: number;    // degrees per shot
    recoilHorizontal: number;  // max degrees per shot (randomized ±)
    recoilRecovery: number;    // spring speed

    // ADS
    adsFOV: number;            // degrees
    adsTime: number;           // seconds to reach ADS
    adsSpreadMult: number;     // spread multiplier while ADS (0.3–0.5)
    adsRecoilMult: number;     // recoil multiplier while ADS (0.6–0.8)

    // Movement
    moveSpeedMult: number;     // multiplier to base move speed
    adsMoveMult: number;       // additional multiplier while ADS

    // Shotgun specific
    pelletCount?: number;
    pelletSpread?: number;     // degrees per pellet cone

    // Viewmodel
    hipPosition: [number, number, number];   // [x, y, z] offset from camera
    adsPosition: [number, number, number];   // [x, y, z] offset for ADS
}
```

### Example Config:

```typescript
const AK47: WeaponConfig = {
    id: 'ak47',
    name: 'AK-47',
    category: 'ar',
    slot: 'primary',
    damage: 34,
    headshotMultiplier: 2.5,
    fireRate: 600,
    fireMode: 'auto',
    magSize: 30,
    reserveAmmo: 120,
    reloadTime: 2.5,
    reloadTimeEmpty: 3.0,
    baseSpread: 1.5,
    bloomPerShot: 0.4,
    maxSpread: 5.0,
    bloomRecovery: 8.0,
    recoilVertical: 1.2,
    recoilHorizontal: 0.6,
    recoilRecovery: 6.0,
    adsFOV: 55,
    adsTime: 0.2,
    adsSpreadMult: 0.4,
    adsRecoilMult: 0.7,
    moveSpeedMult: 0.95,
    adsMoveMult: 0.55,
    hipPosition: [0.3, -0.3, 0.6],
    adsPosition: [0.0, -0.15, 0.4],
};
```

---

## 3. Weapon Modeling (Primitives)

### 3.1 Modular Parts

Each weapon is built from named primitive parts for animation/attachment flexibility:

```
WeaponRoot (TransformNode)
├── Body       (Box)         — Main receiver
├── Barrel     (Cylinder)    — Extends forward
├── Magazine   (Box)         — Detachable for reload anim
├── Stock      (Box)         — Rear extension
├── Grip       (Small Box)   — Below body
├── Sight      (Tiny Box)    — Top of body (iron sight)
└── MuzzlePoint (TransformNode) — Empty node for flash spawn
```

### 3.2 Dimensions by Category

| Category | Body (W×H×D) | Barrel (Ø×L) | Total Tris | Notes |
|----------|-------------|--------------|------------|-------|
| AR | 0.06×0.08×0.35 | 0.03×0.5 | 300–600 | Medium overall length |
| SMG | 0.06×0.07×0.25 | 0.025×0.3 | 250–500 | Compact body |
| Sniper | 0.06×0.09×0.45 | 0.03×0.7 | 400–800 | Long barrel + scope |
| Shotgun | 0.07×0.09×0.30 | 0.04×0.5 | 300–600 | Wider barrel |
| Pistol | 0.04×0.06×0.15 | 0.02×0.1 | 150–300 | Very compact |
| Knife | N/A | N/A | 50–100 | Single box blade + handle |

### 3.3 Construction Code Example

```typescript
function createAssaultRifle(scene: Scene): TransformNode {
    const root = new TransformNode("weapon_ar", scene);

    // Main body (receiver)
    const body = MeshBuilder.CreateBox("body", { width: 0.06, height: 0.08, depth: 0.35 }, scene);
    body.parent = root;

    // Barrel
    const barrel = MeshBuilder.CreateCylinder("barrel", { diameter: 0.03, height: 0.5 }, scene);
    barrel.parent = root;
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.4;

    // Magazine
    const mag = MeshBuilder.CreateBox("magazine", { width: 0.04, height: 0.12, depth: 0.06 }, scene);
    mag.parent = root;
    mag.position.y = -0.08;
    mag.position.z = -0.05;
    mag.rotation.x = -0.15; // Slight angle

    // Stock
    const stock = MeshBuilder.CreateBox("stock", { width: 0.04, height: 0.06, depth: 0.2 }, scene);
    stock.parent = root;
    stock.position.z = -0.25;

    // Grip
    const grip = MeshBuilder.CreateBox("grip", { width: 0.03, height: 0.08, depth: 0.04 }, scene);
    grip.parent = root;
    grip.position.y = -0.06;
    grip.position.z = -0.1;

    // Muzzle flash spawn point
    const muzzlePoint = new TransformNode("muzzlePoint", scene);
    muzzlePoint.parent = root;
    muzzlePoint.position.z = 0.65;

    return root;
}
```

---

## 4. Shooting Mechanics

### 4.1 Method Selection

| Weapon Type | Method | Implementation |
|-------------|--------|----------------|
| AR, SMG, Pistol, Sniper | **Hitscan** (Raycast) | Instant ray from camera center |
| Shotgun | **Multi-ray Hitscan** | 8 rays within pellet cone |
| Knife | **Short Raycast** | 2m ray from camera center |
| Grenades | **Projectile** | Physics body with arc |

### 4.2 Hitscan Implementation

```typescript
function fireHitscan(scene: Scene, camera: Camera, config: WeaponConfig): HitResult | null {
    // Calculate spread
    const spreadAngle = calculateSpread(config);
    const spreadRotation = Math.random() * Math.PI * 2;
    
    // Get forward direction with spread applied
    const forward = camera.getDirection(Vector3.Forward());
    const right = camera.getDirection(Vector3.Right());
    const up = camera.getDirection(Vector3.Up());
    
    const spreadDir = forward
        .add(right.scale(Math.sin(spreadAngle) * Math.cos(spreadRotation)))
        .add(up.scale(Math.sin(spreadAngle) * Math.sin(spreadRotation)))
        .normalize();

    // Cast ray
    const ray = new Ray(camera.position, spreadDir, 200);
    const hit = scene.pickWithRay(ray);
    
    if (hit?.hit && hit.pickedMesh) {
        // Determine hit zone (head, body, limbs)
        const hitY = hit.pickedPoint!.y - hit.pickedMesh.position.y;
        const isHeadshot = hitY > 1.5; // Above shoulder line
        
        const damage = isHeadshot
            ? config.damage * config.headshotMultiplier
            : config.damage;
        
        return { mesh: hit.pickedMesh, point: hit.pickedPoint!, damage, isHeadshot };
    }
    return null;
}
```

### 4.3 Fire Rate Control

```typescript
// Convert RPM to milliseconds between shots
const fireInterval = 60000 / config.fireRate;

// Auto fire: check on each frame
if (isFiring && canFire && Date.now() - lastFireTime >= fireInterval) {
    shoot();
    lastFireTime = Date.now();
}

// Semi-auto: fire only on press (not hold)
if (fireMode === 'semi' && justPressed && canFire) {
    shoot();
}

// Bolt-action: fire on press, then lock until bolt anim completes
if (fireMode === 'bolt' && justPressed && canFire) {
    shoot();
    canFire = false;
    setTimeout(() => canFire = true, boltTime);
}
```

---

## 5. Recoil System

### 5.1 Three-Layer Architecture

```
Layer 1: Primary Kick      → Deterministic vertical + horizontal offset per shot
Layer 2: Random Jitter     → Small random noise (prevents robotic patterns)
Layer 3: Spring Recovery   → Camera returns to pre-recoil position over time
```

### 5.2 Per-Weapon Recoil Profiles

| Weapon | Vertical (°/shot) | Horizontal (°/shot) | Recovery Speed | Pattern |
|--------|-------------------|---------------------|----------------|---------|
| AK-47 | 1.2 | ±0.6 | 6.0 | Pulls up-right, then alternates |
| M4A1 | 0.6 | ±0.3 | 8.0 | Mostly vertical, tight |
| MP5 | 0.4 | ±0.2 | 10.0 | Very controllable |
| Vector | 0.3 | ±0.4 | 12.0 | Fast but scattered |
| AWP | 4.0 | ±0.5 | 3.0 | Single massive kick |
| Shotgun | 3.0 | ±1.0 | 4.0 | Big single kick |
| Deagle | 2.0 | ±0.8 | 5.0 | Heavy pistol kick |

### 5.3 Implementation

```typescript
class RecoilController {
    private offsetX = 0;
    private offsetY = 0;
    
    applyShot(config: WeaponConfig, isADS: boolean) {
        const mult = isADS ? config.adsRecoilMult : 1.0;
        // Deterministic kick
        this.offsetY += config.recoilVertical * mult;
        // Random horizontal
        this.offsetX += (Math.random() - 0.5) * 2 * config.recoilHorizontal * mult;
    }
    
    update(dt: number, config: WeaponConfig) {
        // Spring recovery toward zero
        this.offsetX = Scalar.Lerp(this.offsetX, 0, config.recoilRecovery * dt);
        this.offsetY = Scalar.Lerp(this.offsetY, 0, config.recoilRecovery * dt);
    }
    
    getOffset(): { x: number; y: number } {
        return { x: this.offsetX, y: this.offsetY };
    }
}
```

---

## 6. Spread & Accuracy

### 6.1 Dynamic Cone of Fire

```
Base Spread → + Bloom (per shot) → + Movement Penalty → + Jump Penalty → × ADS Reduction
                                                                          ↓
                                                                    Clamped to Max Spread
                                                                          ↓
                                                               Bloom Recovery over time
```

### 6.2 Spread Values

| Weapon | Base (°) | Bloom/Shot (°) | Max (°) | Recovery (°/s) | ADS Mult |
|--------|----------|----------------|---------|----------------|----------|
| AK-47 | 1.5 | 0.4 | 5.0 | 8.0 | 0.4 |
| M4A1 | 1.0 | 0.3 | 4.0 | 10.0 | 0.35 |
| MP5 | 2.0 | 0.2 | 6.0 | 12.0 | 0.5 |
| Vector | 2.5 | 0.15 | 5.5 | 15.0 | 0.5 |
| AWP | 0.0 | N/A | 0.0 | N/A | 0.0 |
| SAIGA | 5.0/pellet | N/A | 5.0 | N/A | 4.0 |
| Deagle | 0.5 | 0.5 | 4.0 | 6.0 | 0.3 |

### 6.3 State Multipliers

| State | Spread Multiplier |
|-------|-------------------|
| Standing still | 1.0× |
| Walking | 1.3× |
| Sprinting | 3.0× (hip fire only) |
| Jumping / Airborne | 2.5× |
| Crouching still | 0.7× |
| Crouching moving | 0.9× |
| ADS | Per-weapon `adsSpreadMult` |

---

## 7. ADS (Aim Down Sights)

### 7.1 Three Simultaneous Transitions

When the player holds right-click:

```
1. Weapon Position:  hipPosition → adsPosition  (lerp over adsTime)
2. Camera FOV:       baseFOV (80°) → adsFOV     (lerp over adsTime)
3. Mouse Sensitivity: baseSens → baseSens × (adsFOV / baseFOV)
```

### 7.2 ADS Configs

| Weapon | ADS FOV | ADS Time | Has Scope Overlay |
|--------|---------|----------|-------------------|
| AR | 55° | 0.20s | No (iron sights) |
| SMG | 60° | 0.15s | No |
| Sniper | 25° | 0.30s | **Yes** (black vignette) |
| Shotgun | 60° | 0.20s | No |
| Pistol | 65° | 0.15s | No |

### 7.3 Scope Overlay (Snipers Only)

When fully ADS'd with a sniper:
- Render a **full-screen CSS overlay** with circular cutout (scope ring)
- Black vignette around the scope
- Optional: slight lens distortion inside scope circle
- Toggle overlay at ~80% ADS progress

---

## 8. Weapon Switching & Inventory

### 8.1 Slot System

```
Slot 0: Primary   (AR / SMG / Sniper / Shotgun / LMG)
Slot 1: Secondary (Pistol)
Slot 2: Melee     (Knife)
Slot 3: Equipment (Grenade — future)
```

**Input Mapping:**
- `1` key → Primary
- `2` key → Secondary
- `3` key → Melee
- `Q` key → Quick-switch (swap between last two used)
- Scroll wheel → Cycle through slots

### 8.2 Switch State Machine

```
┌───────┐  input   ┌──────────┐  timer  ┌─────────┐  timer  ┌───────┐
│ Ready │────────→│ Lowering │────────→│ Swapping│────────→│Raising│──→ Ready
└───────┘         └──────────┘         └─────────┘         └───────┘
                    0.2–0.3s            (instant)           0.2–0.3s
```

- **Lowering:** Current weapon lerps down + slight rotation
- **Swapping:** Mesh swap happens (instant, invisible)
- **Raising:** New weapon lerps up from below

### 8.3 Constraints

- Cannot fire during switch animation
- Cannot switch while reloading (or: switching cancels reload)
- Cannot switch to same slot
- Sprint auto-cancels ADS before switching

---

## 9. Visual Effects

### 9.1 Muzzle Flash

```typescript
function createMuzzleFlash(scene: Scene): ParticleSystem {
    const ps = new ParticleSystem("muzzleFlash", 15, scene);
    ps.emitRate = 0;                    // Manual burst emission
    ps.minLifeTime = 0.03;
    ps.maxLifeTime = 0.08;
    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD; // Bright additive
    ps.color1 = new Color4(1.0, 0.8, 0.3, 1.0);
    ps.color2 = new Color4(1.0, 0.5, 0.1, 0.8);
    ps.colorDead = new Color4(1.0, 0.2, 0.0, 0.0);
    ps.manualEmitCount = 10;            // Burst 10 particles on fire
    return ps;
}
```

### 9.2 Bullet Impact

Different impacts per surface type:

| Surface | Particle Color | Effect |
|---------|---------------|--------|
| Concrete | Gray/white | Dust puff + small debris |
| Metal | Orange/yellow | Sparks |
| Wood | Brown/tan | Splinters |
| Player | Red | Blood spatter |
| Glass | White/blue | Shards |

### 9.3 Tracer Lines

Even for hitscan, draw a quick tracer line from muzzle to hit point:
```typescript
const tracer = MeshBuilder.CreateLines("tracer", {
    points: [muzzlePoint, hitPoint],
}, scene);
tracer.color = new Color3(1, 0.9, 0.5);
setTimeout(() => tracer.dispose(), 50); // Fade after 50ms
```

### 9.4 Object Pooling

**Never** create/dispose particle systems per shot. Pre-allocate pools:

```typescript
class EffectPool {
    private pool: ParticleSystem[] = [];
    
    constructor(scene: Scene, size: number, factory: (scene: Scene) => ParticleSystem) {
        for (let i = 0; i < size; i++) {
            const ps = factory(scene);
            ps.stop();
            this.pool.push(ps);
        }
    }
    
    emit(position: Vector3): void {
        const ps = this.pool.find(p => !p.isStarted());
        if (ps) {
            ps.emitter = position;
            ps.manualEmitCount = 10;
            ps.start();
            setTimeout(() => ps.stop(), 200);
        }
    }
}
```

---

## 10. Reload System

### 10.1 Two Reload Types

| Type | When | Duration | Animation |
|------|------|----------|-----------|
| **Tactical** | Mag has rounds left | `reloadTime` | Swap mag only |
| **Empty** | Mag is completely empty | `reloadTimeEmpty` | Swap mag + charge bolt/slide |

### 10.2 Procedural Reload Animation Phases

```
Phase 1 — Mag Out (30% of time):
    Magazine mesh lerps down and rotates slightly

Phase 2 — Pause (10% of time):
    Brief visual pause (old mag falls away)

Phase 3 — Mag In (40% of time):
    New magazine lerps up into weapon body

Phase 4 — Bolt/Slide (20% of time, empty reload only):
    Quick snap of bolt catch / slide release
```

### 10.3 State Rules

- Player **cannot fire** during reload
- Player **can cancel** reload by weapon-switching (loses progress)
- Player **can sprint** during reload (interrupts reload)
- Reload auto-triggers on empty mag + fire attempt (optional)

---

## 11. Sound Design Checklist

### Per-Weapon Sound Assets

| Sound | Variations | Priority | Notes |
|-------|-----------|----------|-------|
| **Fire** | 2–3 | Critical | Layer: body + snap + mechanical |
| **Fire (tail/reverb)** | 2 (indoor/outdoor) | High | Swap based on environment |
| **Mag Release** | 1 | Medium | Button click |
| **Mag Out** | 1 | Medium | Metallic slide |
| **Mag In** | 1 | Medium | Thud/click insertion |
| **Bolt/Slide** | 1 | Medium | Chambering |
| **Dry Fire** | 1 | Medium | Empty click |
| **Equip** | 1 | Low | Draw sound |
| **ADS In** | 1 | Low | Subtle click/scrape |
| **ADS Out** | 1 | Low | Subtle click/scrape |

**Minimum per weapon: ~10–12 sound assets**
**Total for full arsenal (8 weapons): ~80–100 sound assets**

---

## 12. Performance Budget

### Particle Effects

| Effect | Max Particles | Max Concurrent | Lifetime |
|--------|--------------|----------------|----------|
| Muzzle Flash | 10–15 | 2 | 0.03–0.08s |
| Bullet Impact | 15–30 | 10 | 0.2–0.5s |
| Tracers | 2 tris each | 5 | 0.05s |
| Shell Casings | 1 mesh each | 5 | 2.0s (then pool) |

**Scene-wide particle budget:** 500–2,000 particles max

### Weapon Mesh Budget

| Metric | Per Weapon |
|--------|-----------|
| Triangles | 300–800 |
| Materials | 1 (dark metal) |
| Draw Calls | 1 |

### WebGPU-Specific

- Use `GPUParticleSystem` when available (moves sim to GPU)
- Fall back to CPU `ParticleSystem` with reduced counts on WebGL2
- Pre-compute random values in textures instead of generating per-frame
- Use `Thin Instances` for shell casings (many identical small objects)
