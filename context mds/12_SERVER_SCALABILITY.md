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

Currently, we send the entire game state (positions, rotations, health) as a JSON string 60 times a second. JSON is highly unoptimized for game networking.

### A. Binary Serialization (Protocol Buffers)
*   **The Problem:** A JSON string like `{"x": 10.51234, "y": 0.00000, "z": -5.12345}` takes up over 50 bytes of bandwidth per player, per tick.
*   **The Solution:** Switch to **Protobuf (Protocol Buffers)** or **FlatBuffers**. These compress data into raw binary. A Vector3 (X, Y, Z) in binary takes exactly 12 bytes (three 32-bit floats). 
*   **Impact:** Reduces server outgoing bandwidth by **70% to 80%**, preventing network cards from choking.

### B. Delta Compression (Snapshots)
*   **The Problem:** We currently send the X, Y, Z position of every player *every 16ms*, even if the player is standing perfectly still AFK.
*   **The Solution:** Delta Compression. The server only transmits data that has *changed* since the last tick. If a player hasn't moved, the server sends a tiny packet that basically says `"Player 5: No Change."`
*   **Impact:** Drastically reduces bandwidth during lulls in combat.

---

## 2. CPU Bottlenecks: The O(N²) Broadcast Problem

In a naive broadcast approach, every 16ms the server iterates through every connected player, constructs a massive state payload of *every* player, and sends it to *every* client. 
If there are 100 players, the server does $100 \times 100 = 10,000$ state evaluations per tick. At 60Hz, that is 600,000 evaluations per second. This will melt the CPU.

### A. Spatial Partitioning (Area of Interest / AOI)
*   **The Concept:** A player on the North side of a massive city map does not need to know the X, Y, Z coordinates of a player on the South side of the map. They can't see them anyway.
*   **The Implementation:** Divide the map into a 2D Grid (e.g., 50x50 meter cells). As players move, they are assigned to a cell.
*   **The Result:** During the 60Hz broadcast tick, the server looks at Player A's cell. It only sends Player A the state of other players in *the same cell* or the *8 adjacent cells*. The server completely ignores the other 90 players across the map.
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
Right now, if the server runs the 60Hz tick in a single `select` loop, doing physics validation for 50 players sequentially might take longer than 16ms, causing the server to skip ticks and lag.
*   **The Solution:** Spawn a separate Goroutine for independent systems. For example, have one Goroutine handle incoming WebSocket reads, one handle physics validation, and one handle outgoing broadcasts.
*   Go channels (`make(chan)`) are designed explicitly for this lock-free data passing.

### B. Client-Side Prediction & Server Reconciliation
To make the game feel perfectly smooth regardless of server load:
*   The client should not wait for the server to confirm movement. The client moves immediately (Prediction).
*   The server simulates the movement in the background. If the server disagrees with the client's position (e.g., the client walked through a wall on their screen), the server sends a "Correction" packet.
*   The client instantly snaps to the server's authoritative position (Reconciliation). This hides lag beautifully.

---

## 5. In-Memory Player State & Data Pipeline Optimizations

**[IMPLEMENTED: 2026-07-16]** 
Our server stores player state in an optimized Data-Oriented pipeline built to handle MMO-scale loads without GC pauses or thread contention.

### A. Mitigating Mutex Contention (Lock-Free Actor Pattern)
*   **The Problem:** At 60Hz with 100+ players, a single `sync.Mutex` acts as a traffic jam. Every incoming network packet and outgoing tick broadcast must wait in line to acquire the exact same lock.
*   **The Solution (Implemented):** 
    *   **Single-Threaded Simulation Loop (Actor Pattern):** We removed mutexes entirely for state reads/writes. Instead, we funnel all incoming actions via Go Channels into the single dedicated `Match.Run()` goroutine. Since only one thread mutates the state sequentially, no locks are required, achieving 100% lock-free concurrency.

### B. Reducing Garbage Collection (GC) Pressure
*   **The Problem:** Allocating new Protobuf message structs and byte buffers for every read/write creates massive memory churn. Furthermore, a `map[string]*Player` is a map of pointers. Go's GC must actively trace every single pointer in that map, leading to long GC pause times (micro-stutters in-game).
*   **The Solution (Implemented):**
    *   **Zero-Allocation Caching:** Instead of `sync.Pool`, we pre-allocate a `GameState` and `ServerMessage` struct directly onto the `Match` object. During the 60Hz tick, we simply overwrite its fields. This results in zero heap allocations during broadcasts.
    *   **Pointer-Free Contiguous Slices (Data-Oriented Design):** We replaced the `map` of pointers with a flat, contiguous array (slice) of structs (`[]Player`). We use an index map (`map[string]int`) for lookups. When a player disconnects, we use an $O(1)$ Swap-and-Pop algorithm to instantly fill the hole without resizing the array.

### C. Data-Oriented Design (DOD) & Entity Component System (ECS)
*   **The Problem:** Traditional object-oriented layouts (like a giant `Player` struct containing physics, networking, and rendering data all jumbled together) cause frequent CPU Cache Misses.
*   **The Solution:** Adopt an Entity Component System (ECS) architecture in Go (e.g., using libraries like `Arche` or `Donburi`). ECS physically organizes data contiguously in memory by component type (e.g., all `Position` structs packed tightly together in memory). This ensures maximum L1/L2 CPU cache hits, allowing systems to iterate over 10,000+ entities in milliseconds using SIMD-like speed.

---

## 6. Asset Delivery & CDN Scalability (OPFS)

As the game scales to dozens of maps and large 3D character models (GLB files exceeding 30MB), standard HTTP delivery from a single server will bottleneck global bandwidth and increase load times unacceptably for returning players.

### A. OPFS (Origin Private File System) Warm-Cache
*   **The Problem:** Standard browser cache (`Cache-Control`) is volatile. The browser can silently evict a 30MB map to save space, forcing returning players to re-download massive assets, which incurs CDN costs and long loading screens.
*   **The Solution:** Implement an OPFS (Origin Private File System) Asset Manager.
    1. **Initial Download:** The game intercepts the asset request and downloads it from the CDN.
    2. **Permanent Storage:** It writes the binary stream directly into the browser's OPFS sandboxed virtual disk.
    3. **Subsequent Loads:** The game bypasses the network entirely, reading the binary `File` or `Blob` directly from the local SSD at native speeds.
*   **Impact:** Massive reduction in CDN bandwidth costs (terabytes saved) and near-instantaneous map load times for returning players, regardless of network conditions.
