# City Strike: Materials Documentation

This document outlines the exact material architecture currently used in the game and provides a catalog of available materials for future development.

## Our Approach: Image-Based PBR via Playground CDNs

We are currently using a **Physically Based Rendering (PBR)** pipeline via Babylon's `PBRMaterial` class. To avoid bloating the repository with heavy texture files and complex compression pipelines, we source our textures directly from **Babylon.js Playground CDNs**.

### How it Works
1.  **Environment Lighting:** Every PBR material requires physical light to reflect. We load a global HDRI environment map (`environment.dds`) that provides realistic ambient lighting and skybox reflections.
2.  **Material Properties:** We assign cloud-hosted textures to the `albedoTexture` (color) and `bumpTexture` (normals/bumps). We then manually tune the `metallic` (0.0 to 1.0) and `roughness` (0.0 to 1.0) properties in code to dictate how the surface reacts to the environment light.

---

## 1. Currently Implemented Materials

These are the materials actively running in the game environment:

### Global Environment
*   **HDRI Skybox & Reflection:** `https://playground.babylonjs.com/textures/environment.dds`
    *   *Usage:* Provides the baseline lighting and reflections for all metals and glossy surfaces.

### Terrain
*   **Asphalt Road:** 
    *   *Albedo:* `https://playground.babylonjs.com/textures/floor.png`
    *   *Normal/Bump:* `https://playground.babylonjs.com/textures/floor_bump.PNG`
    *   *Properties:* Highly tiled (`uScale: 20`, `vScale: 20`), Roughness: 0.8, Metallic: 0.1
*   **Park Concrete Floor:**
    *   *Albedo:* `https://playground.babylonjs.com/textures/grass.jpg` (Used as a gritty concrete/dirt base)
    *   *Properties:* Scaled by 15x, Roughness: 0.9, Metallic: 0.0

### Cover Objects
*   **Wooden Crates:**
    *   *Albedo:* `https://playground.babylonjs.com/textures/wood.jpg`
    *   *Properties:* Roughness: 0.9, Metallic: 0.0
*   **Painted Metal Barrels:**
    *   *Albedo Color:* Solid dark grey (`new Color3(0.4, 0.4, 0.45)`)
    *   *Properties:* Highly reflective (Metallic: 1.0, Roughness: 0.3). These rely entirely on the `.dds` environment texture to reflect the world.

---

## 2. Catalog of Available Materials

If we want to expand the map or add new objects in the future, here is a catalog of reliable, high-speed textures available on the same Playground CDN that we can instantly drop into the game:

### Ground & Structural
*   **Rock / Cliff Base:** `https://playground.babylonjs.com/textures/rock.png`
*   **Rock Normal Map:** `https://playground.babylonjs.com/textures/rockn.png`
*   **Brick Wall:** `https://playground.babylonjs.com/textures/brick.jpg`
*   **Grass (Stylized):** `https://playground.babylonjs.com/textures/grass.png`

### Surfaces & Effects
*   **Water Bump (For pools/puddles):** `https://playground.babylonjs.com/textures/waterbump.png`
*   **Rust Base:** `https://playground.babylonjs.com/textures/albedo.png`
*   **Rust Reflectivity:** `https://playground.babylonjs.com/textures/reflectivity.png`
*   **Impact/Flare Particle:** `https://playground.babylonjs.com/textures/flare.png` (Currently used for muzzle flash)

### Alternative Environments
If we want to change the time of day or lighting, we can swap the HDRI to these pre-filtered skyboxes:
*   `https://playground.babylonjs.com/textures/TropicalSunnyDay_nx.jpg` (and corresponding `_ny.jpg`, `_nz.jpg`, `_px.jpg`, etc.)
*   `https://playground.babylonjs.com/textures/country.env` (A standard `.env` pre-filtered lighting file)
