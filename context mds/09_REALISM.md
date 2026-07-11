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
SSAO calculates tiny contact shadows in corners, crevices, and where objects touch the ground. Without it, objects look like they are floating. Use `SSAO2RenderingPipeline` for high-quality ambient shadows.

### Screen Space Reflections (SSR)
If your map has puddles, wet mud, or marble floors, SSR calculates real-time reflections of the gun, character, and buildings.

### Bloom & Depth of Field
- **Bloom:** Makes emissive surfaces (neon signs, muzzle flashes, sun glare) actually bleed light onto the camera lens.
- **Depth of Field (DoF):** Essential for the FPS "Aim Down Sights" (ADS) mechanic. When the player aims, the background should stay sharp while the gun barrel blurs out slightly, mimicking human eye focus.

---

## Action Plan for Implementation

If you want to implement this in our game, we should proceed in this order:
1. **Lighting Upgrade:** Swap our basic Hemispheric Light for an HDRI `.env` skybox.
2. **Shadow Upgrade:** Implement Cascaded Shadow Maps on the sun.
3. **Material Upgrade:** Swap all our primitive materials for PBR materials with ORM packing.
4. **Post-Processing:** Enable ACES Tone Mapping, Bloom, and SSAO 2.
