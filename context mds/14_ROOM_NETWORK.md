# WarBase Room Networking Context

This document outlines the architecture for the WarBase game rooms, bridging the Go backend and the WebGPU frontend.

## 1. Hybrid Architecture Overview

The system uses a **Hybrid REST + WebSocket** architecture, which is the industry standard for scalable matchmaking in single-server or microservice-based multiplayer games.

*   **REST APIs (Lobby & Matchmaking):** Used for stateless, lightweight operations like viewing active servers or creating a new room. This prevents holding persistent WebSocket connections open for thousands of idle players sitting in the main menu, which would quickly exhaust server resources.
*   **WebSockets (Active Gameplay):** Used exclusively for high-frequency, low-latency binary data transfer (movement, shooting, game state) once a player has explicitly joined a specific game room.

## 2. Backend Implementation (Go Engine)

The core room state is managed entirely in-memory within the Go process.

### `engine/match.go`
*   **`Room` Struct:** Tracks metadata like `ID` (UUID), `Name`, `MapName`, and a map of active `Players` connected via WebSockets.
*   **Thread Safety:** The `Match` struct manages a `map[string]*Room` representing all active operations on the server. Because multiple players might join, leave, or list rooms concurrently via different HTTP handlers or goroutines, the `Rooms` map is protected by a `sync.RWMutex`.
    *   `RLock()` is used when listing rooms (read-only).
    *   `Lock()` is used when creating or deleting rooms (write).

### `cmd/game/handlers.go`
*   **`GET /api/rooms`:** Acquires a read-lock on the match engine, iterates through active rooms, and returns a JSON payload containing `id`, `name`, `map`, and `playerCount`.
*   **`POST /api/rooms`:** Accepts a JSON payload with a desired `name` and `map`. It generates a unique `uuid.New().String()`, creates a new `Room` in the engine, and returns the generated `room_id`.
*   **`GET /connect?room={id}`:** The WebSocket upgrader. It reads the `room` query parameter and assigns the connecting player to the specific `Room` instance in the engine.

## 3. Frontend Implementation (TypeScript & HTML)

### The UI Flow (`client/index.html`)
1.  **Main Menu Load:** The frontend immediately issues a `fetch('/api/rooms')` request to populate the "Server Browser" with active lobbies.
2.  **Creating a Match:** The player fills out the "Operation Name" and selects a Map. Clicking "Initialize" triggers a `fetch('/api/rooms', { method: 'POST' })`.
3.  **State Handoff:** Once a room is selected (or successfully created), the generated `room_id` and `map` name are stored in hidden HTML inputs (`#selectedRoomId` and `#selectedMap`).

### The Game Handoff (`client/src/main.ts`)
*   When the "JOIN MATCH" button is finally clicked, `main.ts` reads the `#selectedRoomId` and `#selectedMap`.
*   It passes `map` to `createScene()` so Babylon.js loads the correct 3D geometry and assets.
*   It passes `room_id` to `NetworkManager`, which opens the WebSocket connection directly to `wss://server/connect?room={room_id}`.

## Why this is the best approach
For a single Go executable (or a load-balanced cluster), keeping active lobby states in Go's memory is incredibly fast and standard practice. Using REST for the lobby keeps the server from maintaining thousands of dead socket connections, reserving the heavy WebSocket processing strictly for active 3D gameplay.
