# Achieving Photorealism in Babylon.js

This document outlines the industry-standard techniques and pipelines required to achieve maximum visual fidelity (photorealism) in a web-based FPS game using Babylon.js, without destroying browser performance.

---

## 1. Textures & Materials (Buildings and Environment)

### PBR (Physically Based Rendering) Workflow
For photorealism, you must abandon `StandardMaterial` and exclusively use **`PBRMaterial`**. PBR simulates how light interacts with real-world surfaces.

To maintain performance, you must use **Channel Packing**. Instead of loading 5 separate texture images for a wall, pack them into an ORM map:
- **Albedo Map:** The base color of the material (RGB).
- **Normal Map:** Adds surface bumps and micro-details without adding geometry (RGB).
- **ORM Map:** Combines Ambient **O**cclusion (Red channel), **R**oughness (Green channel), and **M**etallic (Blue channel) into a single optimized image file.

> [!TIP]
> **Detail Maps:** When players walk right up to a building wall, textures often look blurry. Apply a **Detail Map** (a small, tiling micro-texture of grain or concrete pores) on top of your base material to keep it looking crisp at a 1-inch distance.

### Texture Compression (The Secret to Web Performance)
Loading 4K textures in a browser will crash mobile devices and take minutes to download. The solution is **KTX2 / Basis Universal Compression**.
- KTX2 files remain compressed *on the GPU memory*, drastically reducing VRAM usage.
- **ETC1S Format:** Use for Albedo/Diffuse maps where minor compression artifacts are invisible.
- **UASTC Format:** Use for Normal and ORM maps which require exact pixel precision.

### Anisotropic Filtering
Floors, roads, and walls viewed at an angle will blur out in the distance. Enable Anisotropic Filtering on your textures to keep them sharp at extreme angles.
```typescript
texture.anisotropicFilteringLevel = 4; // Or 8 / 16
```

---

## 2. Realistic Lighting

### Image Based Lighting (IBL) & HDRI
Standard directional lights look flat and fake. Photorealism requires **Image Based Lighting (IBL)**.
1. Download a high-quality HDRI (High Dynamic Range Image) skybox from PolyHaven.
2. Use the Babylon.js Inspector to convert the `.hdr` into a `.env` file.
3. The `.env` file pre-computes **Spherical Harmonics**, giving your environment incredibly realistic ambient bounce lighting and perfect glossy reflections on metallic surfaces instantly.
```typescript
scene.environmentTexture = new BABYLON.CubeTexture("sky.env", scene);
```

### Cascaded Shadow Maps (CSM)
Standard shadows look blocky and terrible in large outdoor FPS maps. **Cascaded Shadow Maps** fix this by rendering high-resolution shadows right next to the player, and lower-resolution shadows on distant buildings.
- Use `CascadedShadowGenerator`.
- Enable **PCSS (Percentage Closer Soft Shadows)**: This simulates realistic contact hardening. A shadow from a building roof will be sharp near the edge of the roof, but soft and blurry on the ground 50 feet below.

---

## 3. Post-Processing Pipelines

To push the game into true photorealism, you need the **Default Rendering Pipeline**.

### ACES Tone Mapping
Digital cameras and monitors clip bright lights (like looking at the sun) to pure white, looking fake. ACES Tone Mapping is the cinematic standard that smoothly curves highlights, mimicking real camera film.
```typescript
pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
```

### Screen Space Ambient Occlusion (SSAO 2)
> [!WARNING]
> **HEAVY HITTER:** SSAO is extremely computationally expensive on WebGPU. Enable with caution or use low sample rates.

SSAO calculates tiny contact shadows in corners, crevices, and where objects touch the ground. Without it, objects look like they are floating. Use `SSAO2RenderingPipeline` for high-quality ambient shadows.

### Screen Space Reflections (SSR)
> [!CAUTION]
> **HEAVY HITTER:** SSR destroys framerates on low-to-mid end machines because it raymarches the depth buffer in real-time. Do not use for multiplayer web games unless strictly targeted at high-end hardware.

If your map has puddles, wet mud, or glossy floors, SSR calculates real-time reflections of the gun, character, and buildings. **Currently Implemented:** We enabled the `SSRRenderingPipeline` and tuned the asphalt road's `roadMat` (`metallic: 0.4`, `roughness: 0.15`) so that it perfectly reflects the neon signs and buildings like a wet street. *(Note: Disabled currently for performance reasons).*

### Bloom & Depth of Field
- **Bloom:** Makes emissive surfaces (neon signs, muzzle flashes, sun glare) actually bleed light onto the camera lens. **Currently Implemented** in the Default Pipeline.
- **Depth of Field (DoF):** Essential for the FPS "Aim Down Sights" (ADS) mechanic. When the player aims, the background should stay sharp while the gun barrel blurs out slightly, mimicking human eye focus.

---

## 4. How They Work Together (The Full Picture)

To summarize the engine architecture currently powering the game:

1.  **PBR (Materials):** Tells the engine what the world is physically made of. Metals reflect the environment; non-metals scatter light. Smooth surfaces reflect sharply; rough surfaces blur reflections.
2.  **IBL (Lighting):** Bathes the PBR materials in photorealistic light. The physics engine wraps the 360-degree HDRI `.env` skybox around the scene. The metallic/smooth PBR materials (like our wet road) literally reflect this photograph back at the camera.
3.  **Post-Processing (Camera Lens):** After Babylon renders the materials interacting with the light, the screen-space pipelines take over. ACES curves the colors cinematically, SSAO injects deep micro-shadows into corners, Bloom scatters the glowing neon light, and SSR scans the screen to bounce real 3D geometry off the wet road.

---

## 5. Advanced Rendering Techniques (Beyond the Core)

For future roadmap planning, Babylon.js supports several AAA-tier rendering techniques that we can explore as optimization allows:

### 5.1 Advanced Material Physics
*   **Sub-Surface Scattering (SSS):** Simulates light entering an object, bouncing around inside, and exiting elsewhere. Used for highly realistic organic materials like skin, wax, or jade. (Extremely expensive).
*   **Clear Coat & Sheen:** Clear Coat adds a secondary shiny layer (like wet car paint). Sheen simulates micro-fibers (like velvet or cloth) catching light at extreme angles.
*   **Refraction & Dispersion:** Bends light passing through meshes (glass/water) and can split it into rainbow colors (prism effect).

### 5.2 Specialized Camera Lenses (`LensRenderingPipeline`)
*   **Distortion & Fisheye:** Curves screen edges like a GoPro or security camera.
*   **Bokeh & Lens Dirt:** Illuminates physical smudges and dust on the virtual camera lens when staring into bright lights.
*   **Anamorphic Lens Flares:** Cinematic horizontal light streaks.

### 5.3 Architecture & Environment Tech
*   **Deferred Rendering:** Separates geometry rendering from lighting. Essential if the city requires hundreds of dynamic streetlamps, as standard Forward Rendering would crash the browser.
*   **Irradiance Volumes (Reflection Probes):** Captures 360-degree snapshots of interior rooms so metallic objects reflect the room they are in, rather than the outdoor skybox.
*   **GPU Particles:** Offloads particle math entirely to the graphics card, allowing millions of particles for massive rainstorms or explosions instead of the standard CPU limit.
*   **Volumetric Height Fog:** Fog that calculates density based on altitude, pooling realistically in valleys and interacting with light scattering.
