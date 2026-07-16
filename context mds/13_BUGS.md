# 🐛 Bug Tracker (Playtest 1)

This document tracks major bugs found during the first public Pinggy playtest (2026-07-16).

---

## 1. The "Ghost Fire" Bug (Critical)
*   **Description:** When multiple players connect over the internet, some players can successfully fire their weapon and see the effects, while other players (including the host) cannot fire at all.
*   **Symptoms:** Pressing left-click does nothing or fails to trigger the `NetworkManager.sendFire()` / server relay correctly for specific clients.
*   **Possible Causes:** 
    *   State desync with the lock-free array pattern (maybe the client ID isn't mapping correctly in the slice).
    *   Input focus issues on the browser (Pointer Lock API failing to capture mouse clicks on certain laptops).
    *   Server dropping `fire` packets for specific indices.

## 2. The Cross-Map Ghost Town (Major)
*   **Description:** A player who loads into the `Village` map can see, shoot, and kill a player who loaded into the `Industrial` map. 
*   **Symptoms:** Because we haven't implemented "Rooms" or "Match Instances" yet, every single player who connects to the WebSocket is dumped into the exact same physics array on the server, regardless of which 3D mesh they loaded on their client.
*   **Solution Needed:** We must implement the "Match Instance" pattern detailed in `12_SERVER_SCALABILITY.md`. The server needs to segregate players into `Rooms` based on their selected map.

## 3. WebGL Engine Dropdown Flipping (UI/UX)
*   **Description:** On certain laptops (likely smaller screen resolutions), the Dropdown Menu in the Tab Scoreboard (used for switching between Auto, WebGPU, and WebGL) flips the wrong way or fails to appear entirely.
*   **Symptoms:** The CSS `z-index` or `position: absolute` dropdown is clipping behind the scoreboard or overflowing the screen bounds on 13-inch laptop screens.
*   **Solution Needed:** Fix the CSS `overflow` properties on the `#scoreboard` and ensure the dropdown is positioned correctly relative to the viewport.
