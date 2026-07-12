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
