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

## 4. ECS State Leak (Havok `hpBodyId` Crash)
**Status:** ✅ FIXED
**Date:** July 21, 2026

**Description:**
Players reported that joining a room, exiting to the main menu, and joining a *second* room would cause the game to freeze. The browser console showed the error: `TypeError: null is not an object (evaluating 'r.hpBodyId')`.

**Root Cause:**
When a player clicks "Exit" to leave a match, `scene.dispose()` correctly wiped the 3D meshes and Havok physics aggregates. However, our internal Data layer (the `bitecs` World and the `ViewMaps.ts` tracking arrays) were never cleared. 

When the player joined the next room, the ECS Movement Systems would boot up and attempt to iterate over the "ghost" IDs from the previous match. It would look up the ghost's Physics Body inside `entityPhysicsBodies`, which returned a destroyed physics object, causing the crash when the engine tried to read its `hpBodyId` property.

**Resolution:**
1. Modified `ecs/ViewMaps.ts` to include a `clearAllViewMaps()` function that flushes out all stored meshes, physics bodies, and weapon arrays.
2. Modified `ecs/World.ts` to include `clearECSWorld()` which safely loops through and deletes all living entities from the `bitecs` registry.
3. Hooked both of these functions into the `btnExitConfirm.onclick` event inside `main.ts` so they execute *before* `scene.dispose()`. 

The ECS state is now 100% sterile and reset between matches!

## 5. Main Menu Laptop Hang (WebGPU Kernel Panic)
**Status:** ✅ FIXED
**Date:** July 22, 2026

**Description:**
The entire laptop would freeze and lock up completely (requiring a hard reboot or force quit) immediately upon opening the game's URL.

**Root Cause:**
The `WebGPUEngine` was attempting to initialize experimental WebGPU support on macOS. Furthermore, it was passing the `enableGPUDebugMarkers: true` configuration flag. On some hardware (especially macOS Safari/Chrome), trying to hook these debug markers into the Metal driver causes a catastrophic kernel panic at the OS compositor level. Additionally, a manual Javascript `performance.now()` frame limiter was intercepting the browser's native compositor loop, exacerbating CPU thrashing.

**Resolution:**
1. Stripped `enableGPUDebugMarkers: true` from the `WebGPUEngine` initialization in `main.ts`.
2. Removed the manual `dt < MIN_FRAME_TIME` frame limiter, handing full rendering control back to the browser's heavily optimized `requestAnimationFrame` via standard `engine.runRenderLoop()`.
3. Default engine remains WebGPU, but the catastrophic flags have been neutralized.

## 6. Visuals Breaking on Successive Matches (Decals, Tracers, Smoke)
**Status:** ✅ FIXED
**Date:** July 22, 2026

**Description:**
Bullet holes, bullet tracers, and impact smoke would stop rendering entirely if a player left a match and joined a second one.

**Root Cause:**
The `DecalSystem`, `TracerSystem`, and `ImpactSystem` were caching their Babylon.js meshes and particle systems in module-level global variables/arrays. When the player left the match, the engine destroyed the actual objects, but the arrays kept the "dead" references. When joining the next match, the systems skipped initialization because they assumed they were already loaded.

**Resolution:**
Modified `initDecalSystem`, `initTracerSystem`, and `initImpactSystem` to actively wipe their internal arrays (`array.length = 0`) and properly re-instantiate fresh Babylon.js meshes and particle emitters whenever a new scene starts.

## 7. Massive Gun Clipping during ADS
**Status:** ✅ FIXED
**Date:** July 22, 2026

**Description:**
When a player right-clicked to Aim Down Sights (ADS), the weapon model would immediately scale up massively, float in the air, and clip through the camera into the player's face.

**Root Cause:**
The physics `WeaponSystem` was using a convoluted, real-time mathematical raycast to handle ADS. It attempted to calculate a vector that would dynamically pull the gun backwards toward the camera so that a local `aimPoint` on the gun's mesh aligned perfectly with a target 0.3 units in front of the camera. Since the gun's hipfire socket was mounted at Z=0.6, the math forced the gun backwards by 0.4 units, ramming the weapon mesh directly into the camera's near-clipping plane. This caused extreme perspective distortion, rendering the gun "massive."

**Resolution:**
1. Stripped out the complex `_tempMathematicalADSPos` raycast projection completely.
2. Replaced the ADS calculation with a smooth `Vector3.LerpToRef` that directly interpolates the `socketOffset.position` between the weapon's pre-configured `config.hipPosition` and `config.adsPosition`. 
3. The weapon now perfectly glides into the hand-tuned iron sights position without intersecting the camera plane, and procedural animations (bob, sway, recoil) are still perfectly applied additively.

## 8. Can't Shoot While Zoomed In (Pointer API Limitation)
**Status:** ✅ FIXED
**Date:** July 22, 2026

**Description:**
Holding right-click to Aim Down Sights (ADS) worked perfectly, but clicking the left mouse button while scoped in did absolutely nothing. The gun would not fire until ADS was released.

**Root Cause:**
Babylon's internal `onPointerObservable` (and raw DOM `pointerdown` events) adhere strictly to the Web Pointer Events API specification. By design, a `pointerdown` event only fires when the physical mouse transitions from **0 buttons pressed to 1 button pressed**. If a user is already holding right-click (1 button pressed), pressing left-click (now 2 buttons pressed) does *not* fire a second `pointerdown` event. Furthermore, attempting to use older `mousedown` events failed because Safari's aggressive Pointer Lock implementation swallows `mousedown` entirely.

**Resolution:**
Reverted to raw DOM `pointerdown`, `pointerup`, and `pointermove` events, but implemented a **Hardware Bitmask Strategy**. Instead of relying on the browser to fire a new event for the second button press, the code now reads the `e.buttons` bitmask on *every single mouse event or tiny movement* (`pointermove`). 
- `(e.buttons & 1)` perfectly isolates the Left Click state.
- `(e.buttons & 2)` perfectly isolates the Right Click state.
This successfully captures simultaneous ADS + Firing inputs without relying on broken browser event queues.

## 9. Invisible Tracers and Missing Impacts during ADS
**Status:** ✅ FIXED
**Date:** July 22, 2026

**Description:**
Bullets and impact smoke were perfectly visible during hipfire, but completely invisible when scoped in (or when spread was very low). Additionally, the browser tab would occasionally crash on macOS Safari with the error: *"This webpage was reloaded because it was using significant memory."*

**Root Cause:**
1. **The CSS Bug**: The scope vignette overlay used a full-screen CSS `radial-gradient` that faded to `rgba(0,0,0,0.95)` in the center. This aggressively dimmed the entire 3D canvas rendering, masking the subtle tracer colors and dark grey smoke.
2. **The Vector Mutation Bug**: Inside `WeaponSystem.ts`, the camera's local direction vectors (`_tempRight` and `_tempUp`) were being permanently mutated/destroyed by `.scaleInPlace()` during the spread calculation. When those corrupted vectors were immediately reused to offset the tracer's spawn position, the math broke, spawning the tracer inside the camera origin instead of the gun barrel. 
3. **The Safari Memory Crash**: Safari strictly limits WebGL memory on Mac/iOS (~1.5GB to 2GB). Although object pooling was correctly implemented for decals and tracers, repeatedly refreshing the tab to debug the invisible bullets overwhelmed Safari's WebGL buffer allocations.

**Resolution:**
1. Replaced the CSS `radial-gradient` with a perfectly transparent center lens using `box-shadow: 0 0 0 100vmax rgba(0,0,0,1)`.
2. Added a fresh `camera.getDirectionToRef()` call inside `WeaponSystem.ts` *after* the spread calculations to ensure the tracer start position uses clean directional vectors.
3. Increased tracer diameter (`0.008` → `0.025`) and adjusted the emissive color to bright yellow-orange to ensure visibility on high-DPI retina screens.