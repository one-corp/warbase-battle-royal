# City Strike: Materials Documentation

This document outlines the material architecture used in the game and provides a catalog of available materials for map generation (e.g., Bullet Force City map).

## Our Approach: Image-Based PBR via Playground CDNs

We are currently using a **Physically Based Rendering (PBR)** pipeline via Babylon's `PBRMaterial` class. To avoid bloating the repository with heavy texture files and complex compression pipelines, we source our textures directly from **Babylon.js Playground CDNs** or use procedural PBR color values.

### How it Works
1.  **Environment Lighting:** Every PBR material requires physical light to reflect. We load a global HDRI environment map (`environment.dds`) that provides realistic ambient lighting and skybox reflections.
2.  **Material Properties:** We assign cloud-hosted textures to the `albedoTexture` (color) and `bumpTexture` (normals/bumps). We then manually tune the `metallic` (0.0 to 1.0) and `roughness` (0.0 to 1.0) properties in code.

---

## 1. Core Map Materials (Bullet Force "City" Style)

Based on our analysis of the Bullet Force "City" map, we need a variety of urban materials. Here is the curated list of materials we will use to achieve that specific look:

### Terrain & Roads
*   **Asphalt Road:** 
    *   *Albedo:* `https://playground.babylonjs.com/textures/floor.png`
    *   *Normal/Bump:* `https://playground.babylonjs.com/textures/floor_bump.PNG`
    *   *Properties:* Highly tiled (`uScale: 20`, `vScale: 20`), Roughness: 0.85, Metallic: 0.1. Gives a gritty, worn asphalt look.
*   **Concrete Sidewalk / Pavement:**
    *   *Albedo:* `https://playground.babylonjs.com/textures/grass.jpg` (Used as a gritty concrete base when desaturated via albedoColor)
    *   *Properties:* Scaled by 15x, Roughness: 0.9, Metallic: 0.0, Color: `new Color3(0.5, 0.5, 0.5)`

### Architecture (Buildings)
*   **Brick Walls (Older Buildings):**
    *   *Albedo:* `https://playground.babylonjs.com/textures/brick.jpg`
    *   *Properties:* Roughness: 0.9, Metallic: 0.0. Tiled based on building height/width.
*   **Concrete Walls (Brutalist / Modern):**
    *   *Albedo:* `https://playground.babylonjs.com/textures/rock.png`
    *   *Normal:* `https://playground.babylonjs.com/textures/rockn.png`
    *   *Properties:* Scaled heavily to look like rough poured concrete. Roughness: 0.8, Metallic: 0.1.
*   **Glass Windows (Skyscrapers):**
    *   *Properties:* No albedo texture. Highly reflective! `albedoColor = new Color3(0.1, 0.2, 0.3)`, `metallic = 1.0`, `roughness = 0.1`, `alpha = 0.7`. Reflects the HDRI skybox beautifully.
*   **Plaster / Stucco:**
    *   *Properties:* Solid color PBR (`new Color3(0.8, 0.75, 0.7)`), Roughness: 1.0, Metallic: 0.0. Used for clean building facades.

### Props & Cover (Shipping Containers, Crates, Barrels)
*   **Wooden Crates:**
    *   *Albedo:* `https://playground.babylonjs.com/textures/wood.jpg`
    *   *Properties:* Roughness: 0.9, Metallic: 0.0
*   **Painted Metal Barrels:**
    *   *Properties:* Solid dark grey (`new Color3(0.3, 0.3, 0.35)`). Highly reflective (Metallic: 1.0, Roughness: 0.3). Relies entirely on the `.dds` environment texture.
*   **Corrugated Shipping Containers:**
    *   *Albedo:* `https://playground.babylonjs.com/textures/albedo.png` (Rust base)
    *   *Properties:* Metallic: 0.5, Roughness: 0.6. Tinted with `albedoColor` to make red, blue, and green variants.

---

## 2. Catalog of Additional Babylon Playground Materials

If we want to expand the map in the future, here is a catalog of reliable, high-speed textures available on the Playground CDN:

*   **Water Bump (For pools/puddles):** `https://playground.babylonjs.com/textures/waterbump.png`
*   **Impact/Flare Particle:** `https://playground.babylonjs.com/textures/flare.png` (Currently used for muzzle flash)
*   **Grass (Stylized):** `https://playground.babylonjs.com/textures/grass.png`

### Alternative HDRI Environments
If we want to change the time of day or lighting, we can swap the HDRI to these pre-filtered skyboxes:
*   `https://playground.babylonjs.com/textures/TropicalSunnyDay_nx.jpg`
*   `https://playground.babylonjs.com/textures/country.env` (A standard `.env` pre-filtered lighting file)
