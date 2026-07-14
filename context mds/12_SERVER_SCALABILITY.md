# Scalability Blueprint: Handling Massive Multiplayer Traffic

---

## Recent Performance Optimizations (2026-07-14)
Below are immediate optimizations made to fix multiplayer lag without full architectural overhauls:

### 1. WebSocket Buffer & Message Size Increases
- **Files Modified:** `server/cmd/game/handlers.go`, `server/internal/engine/client.go`
- **What Changed:**
  - Increased `ReadBufferSize` & `WriteBufferSize` from 1KB → 8KB (8192 bytes)
  - Increased `maxMessageSize` from 1KB → 8KB
  - Increased client send channel capacity from 256 → 512
- **Why:** Small buffers cause backpressure and truncation with larger payloads, especially with multiple players
- **Impact:** Reduced network jitter and prevented packet loss during high-traffic moments

---

While our current Go Server perfectly implements the authoritative anti-cheat logic, it will hit a CPU and Bandwidth bottleneck if we drop 100+ players into a single room.

This document outlines the exact architectural upgrades required to transition the server from a 10-player room to an MMO-scale backend capable of handling hundreds or thousands of concurrent players.

---

## 1. Network Bandwidth Bottlenecks & Serialization

Currently, we send the entire game state (positions, rotations, health) as a JSON string 30 times a second. JSON is highly unoptimized for game networking.

### A. Binary Serialization (Protocol Buffers)
*   **The Problem:** A JSON string like `{"x": 10.51234, "y": 0.00000, "z": -5.12345}` takes up over 50 bytes of bandwidth per player, per tick.
*   **The Solution:** Switch to **Protobuf (Protocol Buffers)** or **FlatBuffers**. These compress data into raw binary. A Vector3 (X, Y, Z) in binary takes exactly 12 bytes (three 32-bit floats). 
*   **Impact:** Reduces server outgoing bandwidth by **70% to 80%**, preventing network cards from choking.

### B. Delta Compression (Snapshots)
*   **The Problem:** We currently send the X, Y, Z position of every player *every 33ms*, even if the player is standing perfectly still AFK.
*   **The Solution:** Delta Compression. The server only transmits data that has *changed* since the last tick. If a player hasn't moved, the server sends a tiny packet that basically says `"Player 5: No Change."`
*   **Impact:** Drastically reduces bandwidth during lulls in combat.

---

## 2. CPU Bottlenecks: The O(N²) Broadcast Problem

In our current `hub.go`, every 33ms we iterate through every connected player, construct a massive state payload of *every* player, and send it to *every* client. 
If there are 100 players, the server does $100 \times 100 = 10,000$ state evaluations per tick. At 30Hz, that is 300,000 evaluations per second. This will melt the CPU.

### A. Spatial Partitioning (Area of Interest / AOI)
*   **The Concept:** A player on the North side of a massive city map does not need to know the X, Y, Z coordinates of a player on the South side of the map. They can't see them anyway.
*   **The Implementation:** Divide the map into a 2D Grid (e.g., 50x50 meter cells). As players move, they are assigned to a cell.
*   **The Result:** During the 30Hz broadcast tick, the server looks at Player A's cell. It only sends Player A the state of other players in *the same cell* or the *8 adjacent cells*. The server completely ignores the other 90 players across the map.
*   **Impact:** Reduces CPU load from $O(N^2)$ down to $O(N)$, allowing a single Go process to handle massive open worlds.

---

## 3. Server Architecture: Scaling Beyond One Machine

A single Go application (even on a supercomputer) has physical limits. To support thousands of concurrent players, the backend must be distributed.

### A. The "Match Instance" Pattern
Instead of one global `Hub`, the architecture must change to support isolated "Rooms" or "Matches".
1.  **Matchmaker Service:** A central REST API that players talk to first. It groups 10 players together.
2.  **Dedicated Game Servers (DGS):** Once 10 players are grouped, the Matchmaker spins up a new isolated Go process (a match instance) specifically for those 10 players.
3.  **Handoff:** The Matchmaker gives the 10 clients the IP and Port of their specific DGS, and they establish WebSockets directly to it.

### B. Kubernetes & Agones (Google Cloud)
To manage these hundreds of isolated Go processes, the industry standard is **Agones** (an open-source project by Google and Ubisoft).
*   Agones sits on top of Kubernetes. 
*   When a match is requested, Agones instantly allocates a Go server container from a warm pool.
*   When the match ends, Agones destroys the container and reclaims the memory.
*   It automatically scales up server nodes across AWS/GCP based on player traffic.

### C. Cross-Server Chat & Global State (Redis / NATS)
If Player A (on Server 1) wants to send a global chat message or a clan invite to Player B (on Server 2), the dedicated game servers cannot communicate directly.
*   **The Solution:** Connect all Go game servers to a central **Redis Pub/Sub** or **NATS** message broker.
*   If Server 1 receives a global chat message, it publishes it to Redis. Server 2 is subscribed to Redis, receives the message, and pushes it down the WebSocket to Player B.

---

## 4. Tick Rate Optimization

### A. Goroutine Per Match (Concurrency)
Right now, our `hub.go` runs the 30Hz tick in a single `select` loop. While Go is fast, doing physics validation for 50 players sequentially might take longer than 33ms, causing the server to skip ticks and lag.
*   **The Solution:** Spawn a separate Goroutine for independent systems. For example, have one Goroutine handle incoming WebSocket reads, one handle physics validation, and one handle outgoing broadcasts.
*   Go channels (`make(chan)`) are designed explicitly for this lock-free data passing.

### B. Client-Side Prediction & Server Reconciliation
To make the game feel perfectly smooth regardless of server load:
*   The client should not wait for the server to confirm movement. The client moves immediately (Prediction).
*   The server simulates the movement in the background. If the server disagrees with the client's position (e.g., the client walked through a wall on their screen), the server sends a "Correction" packet.
*   The client instantly snaps to the server's authoritative position (Reconciliation). This hides lag beautifully.
