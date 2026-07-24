# Graphics & Rendering Pipeline in Babylon.js

This document outlines the exact graphics rendering pipeline and techniques currently active in the project to achieve a balance between visual fidelity and browser performance.

---

## 1. Textures & Materials

### PBR (Physically Based Rendering) Workflow
The game relies exclusively on **`PBRMaterial`** for 3D models (characters, weapons, and maps). PBR simulates how light interacts with real-world surfaces.
Because our models use the `.glb` format, Babylon.js automatically assigns PBR materials to them.

---

## 2. Realistic Lighting

### Image Based Lighting (IBL) & HDRI
PBR materials require an environment texture to calculate ambient light and reflections. Without it, shadows on `.glb` models render as 100% pitch black.
- **Current Setup:** We hardcode `country.env` as the `scene.environmentTexture`.
- **Intensity:** `scene.environmentIntensity` is normalized to `1.0` to provide realistic ambient bounce lighting without blowing out highlights.

### Dynamic Shadows (PCF)
We use a standard `ShadowGenerator` attached to a directional light (representing the sun).
- **PCF (Percentage Closer Filtering):** Enabled for smoother, softer shadow edges.
- **Blur Kernel:** Set to 32 for smooth, feathered shadow penumbras.
- **Transparent Shadows:** Enabled to support shadows passing through transparent textures (like chainlink fences or leaves).

---

## 3. Post-Processing Pipelines

We utilize the **Default Rendering Pipeline** to push visual fidelity further.

### Active Post-Processing Effects
- **FXAA (Fast Approximate Anti-Aliasing):** Enabled to smooth jagged edges on geometry with minimal performance cost.
- **Chromatic Aberration:** An optional tactical lens distortion effect that can be toggled in the UI.

### Inactive / Disabled Effects
- **ACES Tone Mapping:** Disabled. While ACES provides a cinematic color curve, it aggressively crushes midtones and shadows, causing massive visibility issues where players could not see enemies in dark areas. We rely on natural, linear color rendering.
- **Bloom:** Currently disabled for clarity.
- **Anisotropic Filtering:** Currently not implemented to save GPU texture bandwidth.

### "Pro" Graphics Toggles (UI)
Players can enable advanced, heavy-hitting post-processing effects via the Settings menu if their hardware supports it:
- **SSAO (Screen Space Ambient Occlusion):** Calculates tiny contact shadows in corners and crevices.
- **SSR (Screen Space Reflections):** Raymarches the depth buffer to calculate real-time reflections on glossy surfaces.
- **MSAA (Multisample Anti-Aliasing):** Can be toggled to 4x samples for extreme edge smoothing (heavy performance cost).

---

## 4. How They Work Together

1.  **PBR (Materials):** Tells the engine what the world is physically made of. Smooth surfaces reflect sharply; rough surfaces blur reflections.
2.  **IBL (Lighting):** The invisible `.env` skybox bathes the PBR materials in photorealistic light, while the sky rendering uses a crisp, non-blurred skybox map.
3.  **Post-Processing:** The camera smooths edges (FXAA) and applies user-selected tactical overlays (Chromatic Aberration) before presenting the final frame.
