# Goal Description

Transition the Go backend from a simple "Relay Server" into a "Server-Authoritative" architecture to support production-level FPS gameplay. This will include server-side hit registration, lag compensation (rewind buffers), basic anti-cheat (movement validation), and a scalable Goroutine-based match architecture, all without requiring a heavy 3D physics engine on the server.

> [!WARNING]
> This is a significant backend architectural shift. The client will still predict movement and shooting, but the server will now validate everything and track the true "authoritative" state of health and positions.

## User Review Required

Please review the proposed architecture, especially the Hit Registration and Networking choices, before we begin implementation.

## Open Questions

> [!IMPORTANT]
> 1. **Hitbox Fidelity**: For hit registration, should we start with a simple **AABB (Axis-Aligned Bounding Box)** for each player, or a **Cylinder**? (AABB is slightly faster mathematically, Cylinder is rotation-independent and more accurate for human models).
> 2. **Networking**: We are currently using WebSockets. Do you want to stick with WebSockets (easier for browsers, slightly higher latency) or look into WebRTC Data Channels (UDP-like, lower latency, much harder to implement)? I recommend sticking to WebSockets for this iteration.
> 3. **Database**: Should we set up Redis and PostgreSQL now for matchmaking, or keep the server purely in-memory (no database) for this initial validation prototype?

## Proposed Changes

### Server Architecture Layer

#### [NEW] `server/internal/engine/geometry.go`
- Implement 3D math primitives: `Vector3`, `AABB`, `Ray`.
- Implement `RayIntersectsAABB(ray, box)` math for server-side hit detection.

#### [NEW] `server/internal/engine/history.go`
- Implement a `SnapshotBuffer` (Ring Buffer slice).
- Implement interpolation logic to rewind hitboxes based on a given timestamp (`GetInterpolatedBox(timestamp)`).

#### [MODIFY] `server/internal/engine/player.go`
- Add `AABB` or `Cylinder` bounds to the player struct.
- Add `SnapshotBuffer` to store historical positions for the last 1 second (60 snapshots at 60Hz).
- Add health and death state (server now controls HP).

#### [MODIFY] `server/internal/engine/match.go`
- Transition to the Actor Model: The match runs in an isolated Goroutine.
- Add an `InputChan` to safely queue client inputs.
- Implement the 60Hz server tick loop (`time.Ticker`).
- Add Movement Validation (`ValidateMovement()`) to check for speed hacks (distance over time).
- Add Hit Registration: When receiving a `FIRE` event, read the client's timestamp, rewind the target's hitbox using the history buffer, and perform a raycast. If hit, deduct health and broadcast damage.

#### [MODIFY] `server/cmd/game/handlers.go`
- Update the WebSocket message router to send inputs to the specific Match's `InputChan` instead of blindly relaying them.

### Client Synchronization Layer

#### [MODIFY] `client/src/network/NetworkManager.ts`
- Client must now send a `timestamp` with every `FIRE` event to allow the server to calculate lag compensation.
- Handle authoritative corrections (if the server rejects a movement, the client must rubber-band back to the server's position).

#### [MODIFY] `client/src/physics/WeaponSystem.ts`
- Remove client-side damage calculation. The client can still play hit effects/tracers immediately (prediction), but health deduction and death only happen when the server confirms the hit.

## Verification Plan

### Automated Tests
- Write Go unit tests in `geometry_test.go` to verify Ray-AABB intersection math.
- Write Go unit tests in `history_test.go` to verify the Ring Buffer correctly interpolates positions between ticks.

### Manual Verification
- **Anti-Cheat:** Modify the client code locally to send a huge position jump (teleport/speedhack). Verify the server rejects it and rubber-bands the player.
- **Hit Registration:** Shoot another player. Verify that the server calculates the hit, logs the hit detection, deducts health, and triggers the death sequence when HP reaches 0.
- **Lag Compensation:** Artificially inject latency (e.g., Chrome network throttling). Shoot a moving target based on where they are on *your* screen. Verify the server successfully rewinds their hitbox and registers the hit.
