# Babylon.js Native Features & Materials

Babylon.js is an incredibly powerful web game engine. Below is a categorized list of native features, shapes, and materials that come built-in right out of the box.

## 🎨 Materials
Babylon.js offers several material types for styling your objects:

*   **`StandardMaterial`**: The classic lighting material. Supports diffuse (base color), specular (highlight), emissive (glow), and ambient textures/colors. Fast and efficient.
*   **`PBRMaterial` (Physically Based Rendering)**: The modern industry standard. Simulates real-world light physics using Metallic and Roughness values. Perfect for realistic games (this is what your GLB weapons use natively!).
*   **`NodeMaterial`**: A node-based visual shader editor. You can design complex custom shaders (water, lava, magic effects) using a visual graph and load them directly into your game.
*   **`BackgroundMaterial`**: Extremely optimized for rendering skyboxes and distant environmental domes.
*   **`WaterMaterial`**: A specialized community material for rendering realistic water surfaces with reflection, refraction, and ripples.
*   **`TerrainMaterial`**: Used for blending multiple textures on a heightmap (e.g., mixing grass, dirt, and rock on a mountain).

## 🧱 Native Primitive Shapes (MeshBuilder)
You don't always need 3D models. Babylon can generate these perfect mathematical shapes instantly:

*   `CreateBox` (Cubes, walls, crates)
*   `CreateSphere` (Balls, tree leaves, planets)
*   `CreateCylinder` (Pillars, tree trunks, pipes)
*   `CreatePlane` / `CreateGround` (Floors, walls, UI surfaces)
*   `CreateCapsule` (The standard FPS player hitbox)
*   `CreateTorus` (Rings, donuts)
*   `CreateLines` / `CreateDashedLines` (Lasers, paths, debug rays)
*   `CreatePolygon` (Custom 2D shapes extruded into 3D)

## 💡 Lighting & Shadows
*   **`HemisphericLight`**: Ambient environmental light (simulating sky and ground bounce light).
*   **`DirectionalLight`**: Sun/Moon light that casts long, parallel shadows.
*   **`PointLight`**: A lightbulb that emits light in all directions.
*   **`SpotLight`**: A flashlight/headlight cone of light.
*   **Shadows**: Handled via `ShadowGenerator`. Supports soft shadows (PCF, PCSS) and blurred contact shadows.

## 🏃 Physics & Movement
*   **Havok Physics**: Native integration with Havok (the same engine used in Half-Life 2 and Breath of the Wild). Supports rigid bodies, ragdolls, and raycasting.
*   **Collisions Engine**: A built-in lightweight sliding collision system (used for basic walking/jumping without needing full Havok physics).

## 🌳 Performance Optimizations
*   **`ThinInstances`**: Renders 10,000+ identical objects (like trees or grass) in a single GPU draw call. (We are using this for your park!)
*   **`SolidParticleSystem` (SPS)**: Excellent for destructible meshes or blocky voxel worlds (like Minecraft).
*   **Frustum Culling & Octrees**: Automatically ignores objects behind the camera to boost FPS.

## ✨ Visual Effects
*   **Particle Systems**: Native GPU/CPU particle generators for fire, smoke, muzzle flashes, and explosions.
*   **Post-Processes**: Built-in screen effects like Bloom (glow), Motion Blur, Depth of Field, FXAA/SMAA (anti-aliasing), and SSAO (ambient occlusion shadows in corners).
