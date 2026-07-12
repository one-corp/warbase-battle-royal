# Animation Test Viewer

To ensure complex character animations (like aiming, walking, and firing simultaneously) blend perfectly before integrating them into the chaotic multiplayer game environment, we use a standalone **Animation Test Viewer**.

## How It Works
The Animation Test Viewer is a completely isolated HTML page (`/public/test_anim.html`) that loads the Babylon.js engine and our character models in a sterile, gray-box environment. It bypasses the Node.js server, WebSockets, and multiplayer logic, allowing us to debug raw visual geometry and animation groups in real-time.

## Features
- **Direct Animation Triggers**: Buttons allow you to instantly toggle specific animation states (`idle`, `running`, `firing`, `firing walk`, `jump`).
- **Real-time Blending Debugging**: You can see exactly how Babylon.js's `AnimationGroup.play(true)` and `setWeightForAllAnimatables` behaves when transitioning between lower-body movement and upper-body weapon handling.
- **Hitbox/Bone Visualization**: Provides an isolated space to render `scene.debugLayer` without the clutter of the main game map.

## How to Use
1. Start your local development server:
   ```bash
   npm run dev
   ```
2. Open a new browser tab and navigate to:
   `http://localhost:5173/test_anim.html`
3. Use the UI buttons on the left side of the screen to trigger animations and verify their transitions.

## Current Supported Animations
- `idle`: Standard resting state with slight weapon sway.
- `running`: Full body sprint animation.
- `firing`: Upper body recoil and shell ejection, lower body planted.
- `firing walk`: Upper body recoil mixed with lower body walking locomotion.
- `jump`: Airborne state with weapon braced.

*Note: Any new animations added to the `GLB` model via Blender should be tested in this viewer first before wiring them into the `NetworkManager`!*
