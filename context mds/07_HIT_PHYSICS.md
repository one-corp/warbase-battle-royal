# 💥 Hit Physics & Damage System Blueprint

> Hitscan detection, networking, and player damage resolution mechanics.

---

## 1. Core Architecture: Unified Havok Hitscan

We utilize a **Hitscan** (instant raycast) architecture for standard weapons (Assault Rifles, SMGs, Pistols) instead of physical projectiles. To ensure highly accurate hit detection and pave the way for future explosive ragdoll physics, the hit registration is powered natively by **Havok Physics V2**.

### 1.1 Kinematic Havok Hitboxes (While Alive)
When a remote player is instantiated in `MultiplayerEntities.ts`, we dynamically spawn primitive meshes (Capsules, Boxes, Spheres) attached to their bones.
- **PhysicsAggregate**: These meshes are wrapped in `BABYLON.PhysicsAggregate` with `mass: 0`.
- **ANIMATED Motion Type**: We set `aggregate.body.setMotionType(PhysicsMotionType.ANIMATED)` and `disablePreStep = false` so that Havok forces the physics body to perfectly track the animation of the bone it's attached to.
- **Triggers**: Crucially, we set `aggregate.shape.isTrigger = true`. This prevents the "Invisible Wall" bug where the local player physically collides with the remote player's hitboxes. Triggers ignore physical bumping but STILL register raycasts!
- **Metadata**: Each hitbox mesh holds critical metadata for damage calculation (e.g., `zone: "head", multiplier: 2.5`).

### 1.2 The Unified Raycast (`WeaponSystem.ts`)
Instead of using Babylon's standard visual raycast for decals and a separate raycast for damage, we use a single, unified Havok raycast for everything to prevent "Ghost Bullet" desync bugs.

```typescript
const query = { shouldHitTriggers: true, ignoreBody: localPlayerBody };
const physResult = scene.getPhysicsEngine().raycast(origin, end, query);

if (physResult.hasHit) {
    const hitMesh = physResult.body.transformNode;

    if (hitMesh.metadata && hitMesh.metadata.isHitbox) {
        // Player Hit! Deal Damage
        const targetId = hitMesh.metadata.playerId;
        const finalDamage = Math.round(activeConfig.damage * hitMesh.metadata.multiplier);
        networkManager.sendHit(targetId, finalDamage);
    } else {
        // Environment Hit! Spawn Decal at physResult.hitPointWorld
    }
}
```

### 1.3 Environment Physics Interaction (Ammo Boxes / Crates)
Small environmental props, like wooden crates or ammo boxes, are given physical weight and friction using Havok. When a bullet hits them, we apply an instant physical **Impulse** to simulate kinetic impact.

```typescript
if (hitMesh.physicsBody && hitMesh.physicsBody.getMotionType() === PhysicsMotionType.DYNAMIC) {
    // scale(10) determines the kinetic impact force of the bullet
    hitMesh.physicsBody.applyImpulse(spreadDir.scale(10), physResult.hitPointWorld);
}
```
This causes the crates to realistically flip, spin, or slide backward when shot.

---

## 2. Visual Feedback (The Hitmarker)

Before the server even knows about the shot, your local client instantly gives you visual feedback. It flashes your UI crosshair bright **Red** for 100 milliseconds to confirm the impact. This instant client-side prediction makes the combat feel incredibly snappy.

```typescript
crosshairH.color = zone === "head" ? "red" : "rgba(255, 0, 0, 0.7)";
crosshairV.color = zone === "head" ? "red" : "rgba(255, 0, 0, 0.7)";
setTimeout(() => {
    crosshairH.color = "white";
    crosshairV.color = "white";
}, 100);
```

---

## 3. Server-Authoritative Health

The client **does not** manage its own health. The Go backend (`hub.go`) acts as the authoritative source of truth to prevent cheating.

### 3.1 Damage Processing (Go Server)
When the server receives a `sendHit()` packet, it verifies both players are alive, deducts the specific weapon damage from the target's HP, and checks for death.

```go
case "hit":
    var hit HitEvent
    json.Unmarshal(event.Payload, &hit)
    
    target, okTarget := h.players[hit.Target]
    shooter, okShooter := h.players[message.SenderID]
    
    if okTarget && !target.IsDead {
        // Deduct health
        target.Health -= hit.Damage
        
        // Handle Death
        if target.Health <= 0 {
            target.Health = 0
            target.IsDead = true
            target.Deaths++
            
            if okShooter {
                shooter.Kills++
            }
        }
    }
```

### 3.2 Network Broadcast
On the next 30Hz network tick, the server broadcasts the updated state (including the new `Health`, `IsDead`, and updated `Kills`/`Deaths` tallies) back to all clients.

---

## 4. Death & Respawn Logic (Future Integration)

When a player's health drops to 0, they will trigger a death state.

**Future Ragdoll Setup:** 
At this point, we will instantiate a `new BABYLON.Ragdoll(skeleton, mesh, config)` using a predefined Mixamo-to-Havok bone map. We will call `ragdoll.ragdoll()` to detach the character from the animation loop and let Havok gravity and physics take over. If they were killed by a grenade, we will use `physicsBody.applyImpulse()` to blast the ragdoll away.

### 4.1 Locking Controls
To prevent a dead player from moving or shooting, the client forcibly exits the Pointer Lock API.

```typescript
if (myState.isDead && !isLocalDead) {
    isLocalDead = true;
    document.exitPointerLock(); // Freezes camera and hides crosshair
}
```

### 4.2 Automated Respawn Loop
A 3-second timer begins counting down on the death screen. Once the timer hits 0, the client fires a `sendRespawnRequest()` to the server. 
The server resets the player's health to 100, sets `IsDead` to false, and the client teleports the player to a random coordinate within the spawn zone, instantly resuming gameplay.
