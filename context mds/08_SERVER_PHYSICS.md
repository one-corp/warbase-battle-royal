# Network Architecture: Hit Detection & Physics

This document explains exactly how our Babylon.js client interacts with the Havok physics engine and the Go multiplayer server during combat.

## 1. Client-Authoritative Hit Detection

Our game currently uses a **Client-Authoritative** hit detection model. This is standard for fast-paced web shooters (like Krunker or Bullet Force) because it guarantees zero latency when shooting. If you click and your crosshair is on an enemy on *your* screen, it's a guaranteed hit.

### The Shooting Sequence:
1. **Trigger Pull:** You click the mouse. `WeaponSystem.ts` calculates a randomized bullet spread vector based on your weapon's accuracy stats.
2. **Raycast (Hitscan):** Babylon shoots an invisible laser (a `Ray`) out of your camera along that vector up to 200 meters. 
3. **Collision Filter:** The ray searches for intersections with all pickable meshes (players, crates, buildings).
4. **Decals & Impact:** If the ray hits static geometry (a building or the ground), a bullet hole decal is dynamically generated and mathematically rotated to sit perfectly flat against the surface normal.
5. **Local Physics Impulse:** If the ray hits a physics object (like a crate), Havok physics instantly applies a 10-unit impulse force to that exact pixel, knocking the crate backward natively on your machine.
6. **Network Dispatch:** If the ray hits a mesh tagged with `playerId`, the client immediately sends a JSON payload to the Go server:
   ```json
   { "type": "hit", "payload": { "target": "uuid-1234", "damage": 25 } }
   ```

> [!TIP]
> **Why Client-Authoritative?** 
> If we used Server-Authoritative hit detection, you would have to "lead" your shots to account for ping, which feels terrible in an FPS. The tradeoff is that client-authoritative games are slightly more susceptible to hackers, which is acceptable for this prototype.

---

## 2. Server-Authoritative Validation (Anti-Cheat & Health)

While the client decides *if* a hit lands, the **Go Server** is the absolute authority on Health, Kills, Deaths, and whether a player is alive or dead.

### The Go Server Validation Loop (`hub.go`):
When your client sends a lightweight `sendHit(targetId, damageAmount)` packet via WebSocket, the authoritative Go backend acts as the ultimate judge. 

1. **Receiving Hits:** The server receives the `hit` payload. It looks up the target player and the shooter in its internal memory map (`h.players`).
2. **Anti-Cheat Validation:** The server verifies:
   - *Is the shooter actually alive?* (You can't deal damage if you just died).
   - *Is the target actually alive?* (You can't deal damage to a dead player).
   ```go
   target, okTarget := h.players[hit.Target]
   shooter, okShooter := h.players[message.SenderID]
   
   if okTarget && !target.IsDead { // Valid Hit!
   ```
3. **Damage Calculation:** If valid, the server subtracts the weapon's specific damage value from the target's HP. 
4. **Death Trigger:** If Health drops to 0 or below, the server overrides the player's state:
   * Sets `Health = 0`
   * Sets `IsDead = true`
   * Increments the Target's `Deaths` counter.
   * Increments the Shooter's `Kills` counter.
   * Forcefully overrides their animation state to `"death"`.

> [!IMPORTANT]
> **Ghost Prevention:** Once the server marks a player as dead (`IsDead = true`), it completely drops and ignores any further position updates sent by that client. This prevents a dead player's client from "running around" as a ghost on other screens while waiting to respawn.

---

## 3. The 30Hz State Synchronization

To keep all browsers in sync without lagging the server, the Go Server runs a massive "Tick" exactly 30 times a second (30Hz).

1. **State Aggregation:** The server bundles every single player's X/Y/Z position, rotation, current animation, Health, Kills, and Deaths into one giant JSON object.
2. **Broadcast:** It fires this JSON object across the WebSockets to every connected client.
3. **Client Interpolation:** `MultiplayerEntities.ts` receives this state. Instead of instantly teleporting the remote players to the new coordinates (which looks choppy), it pushes the coordinates into a `stateBuffer` and smoothly interpolates (glides) the 3D meshes between the ticks at 60+ FPS on your monitor. 

### Muzzle Flashes & Fire Events
Unlike position updates (which are buffered at 30Hz), the act of firing a gun is **Instantaneous**. 
When you shoot, your client sends a `"fire"` event. The Go server bypasses the 30Hz loop and instantly reflects that `"fire"` event to all *other* clients. This triggers the particle system muzzle flash and gunshot sound effect on their screens with zero delay, ensuring combat feels highly responsive!
