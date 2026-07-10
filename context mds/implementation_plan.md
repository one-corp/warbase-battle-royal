# Realistic Material Implementation Plan

Based on the deep research outlined in the `materials.md` artifact, I propose upgrading the visual fidelity of City Strike using Image-Based PBR workflows powered by an HDRI environment.

## User Review Required
> [!IMPORTANT]
> Because PBR requires physical light to reflect off metallic and rough surfaces, we MUST add an HDRI Environment map to the scene, otherwise everything will look pitch black or broken.
> Also, downloading high-quality PBR textures (Albedo, Normal, ORM) requires external image hosting or downloading local files. For this prototype, I will configure the materials using direct URLs to free, compressed cloud-hosted textures (like those provided on Babylon.js playgrounds or CDNs) to ensure it works instantly without you having to manually download and place megabytes of textures in the project folder. 

## Proposed Changes

### [MODIFY] `src/Environment.ts`
1.  **HDRI Lighting:** Load a pre-filtered `.env` file (e.g., standard Babylon environment) to provide realistic ambient lighting and skybox reflections.
2.  **PBR Road Material:** Replace the `StandardMaterial` on the road mesh with a `PBRMaterial`. Assign tiling Albedo, Normal, and ORM maps of asphalt to it.
3.  **PBR Concrete Park Floor:** Replace the standard green park floor with a realistic concrete `PBRMaterial` with a large UV scale (`uScale`, `vScale`) to cover the area.

### [MODIFY] `src/BuildingGenerator.ts` (Or wherever obstacles are spawned)
1.  **PBR Metal Crates:** Replace the basic red/blue boxes with `PBRMaterial` featuring high metallic and low roughness values, paired with a scratched metal normal map.
2.  **PBR Wood Blocks:** Replace some cover blocks with a highly rough, non-metallic wood PBR material.

## Verification Plan
1.  Once implemented, I will launch the dev server.
2.  I will verify that the skybox/HDRI loads and lights the scene.
3.  I will check that the asphalt road and concrete park floor tile correctly without looking overly repetitive.
4.  I will ensure FPS remains stable (60 FPS) when rendering these new shaders.
