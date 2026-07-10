# 💥 Hit Physics & Damage System Blueprint

> Hitscan detection, networking, and player damage resolution mechanics.

---

## 1. Core Architecture: Hitscan

We utilize a **Hitscan** (instant raycast) architecture for standard weapons (Assault Rifles, SMGs, Pistols) instead of physical projectiles. This ensures snappy, responsive combat over the web without the networking overhead of syncing hundreds of physics bullets.

### 1.1 The Firing Raycast
When the local player clicks to fire, the `WeaponSystem` casts a `Ray` forward from the exact center of the `UniversalCamera`.

```typescript
// Spread calculation (bloom) based on movement/recoil
const spreadRadius = activeConfig.baseSpread + currentSpread;
const randX = (Math.random() - 0.5) * spreadRadius;
const randY = (Math.random() - 0.5) * spreadRadius;

// Create ray from camera center
const forward = camera.getDirection(Vector3.Forward());
const up = camera.getDirection(Vector3.Up());
const right = camera.getDirection(Vector3.Right());

const spreadDir = forward.add(right.scale(randX)).add(up.scale(randY)).normalize();
const ray = new Ray(camera.position, spreadDir, activeConfig.range);

// Perform raycast against all meshes
const hit = scene.pickWithRay(ray);
```

### 1.2 Environment Physics Interaction
If the ray strikes an environmental mesh that has a physical Havok body (e.g., wooden crates), we apply an instant physical impulse to the hit point, causing crates to realistically flip or get knocked backward by gunfire.

```typescript
if (hit.pickedMesh.physicsBody) {
    hit.pickedMesh.physicsBody.applyImpulse(spreadDir.scale(10), hit.pickedPoint);
}
```

---

## 2. Remote Player Hit Detection

### 2.1 Mesh Metadata Tagging
To identify *who* was shot, every sub-mesh of a remote player's 3D model (e.g., the `Soldier.glb`) is recursively tagged with their `playerId` during the spawning phase in `MultiplayerEntities`.

```typescript
// Inside spawnPlayer()
rootNode.getChildMeshes().forEach(mesh => {
    // Crucial: Tagging mesh with network ID for hitscan resolution
    mesh.metadata = { playerId: id }; 
});
```

### 2.2 Resolving the Hit
When the raycast strikes a mesh, we simply check the `metadata` property. If it contains a `playerId`, we have successfully hit an enemy.

```typescript
if (hit.pickedMesh.metadata && hit.pickedMesh.metadata.playerId) {
    const targetId = hit.pickedMesh.metadata.playerId;
    
    // Transmit the damage event to the authoritative Go server
    networkManager.sendHit(targetId, activeConfig.damage);
    
    // Trigger local UI feedback (Hitmarker)
    showHitmarker();
}
```

---

## 3. UI Feedback: Hitmarkers

When a shot successfully strikes a remote player mesh, we provide instant visual feedback to the shooter. We achieve this by flashing the center UI crosshair bright **Red** for 100 milliseconds before returning it to White.

```typescript
crosshairH.color = "red";
crosshairV.color = "red";
setTimeout(() => {
    crosshairH.color = "white";
    crosshairV.color = "white";
}, 100);
```

---

## 4. Server-Authoritative Health

The client **does not** manage its own health. The Go backend (`hub.go`) acts as the authoritative source of truth to prevent cheating.

### 4.1 Damage Processing (Go Server)
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

### 4.2 Network Broadcast
On the next 30Hz network tick, the server broadcasts the updated state (including the new `Health`, `IsDead`, and updated `Kills`/`Deaths` tallies) back to all clients.

---

## 5. Death & Respawn Logic

When the local client receives a network packet indicating its own `isDead` state is `true`, it triggers the death flow.

### 5.1 Locking Controls
To prevent a dead player from moving or shooting, the client forcibly exits the Pointer Lock API.

```typescript
if (myState.isDead && !isLocalDead) {
    isLocalDead = true;
    document.exitPointerLock(); // Freezes camera and hides crosshair
}

// In the input click listener:
if (!isLocked && !isLocalDead) {
    engine.enterPointerlock();
}
```

### 5.2 The Death Screen Overlay
A full-screen, translucent red UI overlay with a bold "YOU DIED" message is displayed, overlaying the active camera view. 

### 5.3 Automated Respawn Loop
A 3-second timer begins counting down on the death screen. Once the timer hits 0, the client fires a `sendRespawnRequest()` to the server. 
The server resets the player's health to 100, sets `IsDead` to false, and the client teleports the player to a random coordinate within the spawn zone, instantly resuming gameplay.
