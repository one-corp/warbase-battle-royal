# 🧪 Testing Procedures & Guidelines

## Overview
Because this is a hardware-accelerated 3D application running in the browser (WebGL 2 / WebGPU via Babylon.js), automated headless testing (like standard Jest unit tests) cannot fully validate rendering, physics, or shader compilation.

We rely on a combination of local browser testing and specific procedures for automated QA.

## 1. Local Browser Testing (Primary QA)

The most reliable way to test game feel, physics collisions, and rendering artifacts is via direct human-in-the-loop testing on your local machine.

### Instructions:
1. Start the Vite development server:
   ```bash
   npm run dev
   ```
2. Open your local browser (Chrome or Edge recommended for best WebGL 2/WebGPU support) and navigate to `http://localhost:5173`.
3. Open the **Browser Developer Tools (F12)** and keep the **Console** tab open.
4. **Important Checkpoints:**
   - **Console Errors:** Watch for Babylon.js shader compilation errors or missing texture warnings.
   - **Physics:** Walk into walls (buildings). If you clip through, the Havok physics bounding box is misaligned.
   - **Rendering:** Look for "Z-fighting" (flickering textures where two planes overlap) or Frustum Culling issues (objects disappearing when you look away).

## 2. Agentic & Automated Testing Limitations

### macOS Constraints
When developing with an AI Agent, note that the agent's internal browser subagent tools **cannot launch local Chrome environments on macOS**. 
If the agent attempts to use the `open_browser_url` tool on a macOS host, it will fail with: `local chrome mode is only supported on Linux`.

**Workaround:** The user must act as the "eyes" of the agent, or the agent must rely on programmatic terminal scripts (like parsing the Vite server logs or using a custom Playwright script) to verify execution.

## 3. Playwright (Future Integration)

For future CI/CD integration, we will use **Playwright** to spin up a headless Chromium instance that supports WebGL.
*   Playwright can navigate to the local server, capture a screenshot of the `<canvas>`, and compare it to a baseline image.
*   It can also hook into `console.error` and automatically fail the test if Babylon throws a runtime exception.

## 4. Multiplayer Testing Workflow (Puppeteer)

Testing multiplayer in a WebGL/WebGPU game can be challenging because you need multiple clients connected to the server concurrently to observe real-time state synchronization, animations, and weapon scaling across different views. 

To automate and streamline this process without manually opening multiple browser windows, we created a headless browser testing script using **Puppeteer**.

### `test_multi.js` Setup

The test script is located in the `scratch` directory (`test_multi.js`). It uses Puppeteer to launch two concurrent chromium browser instances.

#### How it works:
1. **Launch Browser Instances**: The script launches two independent browser contexts using `puppeteer.launch({ headless: "new" })`. The `headless` mode means it runs in the background without opening a visible UI, making it extremely fast.
2. **WebGPU Support**: By passing specific args (`--enable-unsafe-webgpu`, `--enable-features=Vulkan`), Puppeteer allows the headless Chromium instance to initialize the Babylon.js WebGPU engine successfully.
3. **Connect Clients**:
   - **Client 1** navigates to `http://localhost:5173/` and logs in with a specific username (e.g., `test1`).
   - **Client 2** navigates to the same URL and logs in with another username (`test2`).
4. **Console Monitoring**: The script hooks into the `page.on('console')` event of both clients. This is the crucial part: it pipes all `console.log`, `console.warn`, and `console.error` outputs from the headless game directly to our terminal window.
5. **Action Simulation**: Using `page.evaluate()`, we can inject JavaScript directly into the client's execution context. For example, we can simulate keyboard presses or mouse clicks to make Client 1 shoot, move, or jump, and then observe if Client 2 receives the network events correctly.

#### Example Console Output
When running the script, you get a clean log showing the sequence of events across both clients in real-time:
```text
Launching Client 1...
[CLIENT 1 CONSOLE]: Successfully initialized WebGPU Engine
[CLIENT 1 CONSOLE]: Connected to Go Server!
Launching Client 2...
[CLIENT 2 CONSOLE]: Successfully initialized WebGPU Engine
[CLIENT 2 CONSOLE]: Connected to Go Server!
```

### Why this is useful
- **Verifying Network Serialization**: We can verify that the Go server is correctly broadcasting `state` and `fire` payloads without packet splitting issues.
- **Debugging Animation States**: By adding a simple `console.log(remotePlayer.currentState)` in `MultiplayerEntities.ts`, we can verify that Client 2 correctly triggers a "run" or "fire" animation when Client 1 moves.
- **Performance Profiling**: We can detect if a specific action (like shooting or creating decals) causes the render loop to crash or throw exceptions on the remote clients without needing to have the game open visually.

### Running the Test
To run the multiplayer headless test, simply execute the node script from the workspace root:
```bash
node scratch/test_multi.js
```
*Note: Ensure both the Vite dev server (frontend) and the Go server (backend) are running before executing the test.*
