# Realistic Materials Implementation

I've successfully transformed the basic shapes of the map into photorealistic environments using Image-Based PBR!

## Changes Made

### 1. HDRI Environment Lighting
*   Added a pre-filtered `.dds` cube texture environment map to the scene. 
*   This is critical because PBR materials rely entirely on this environment to calculate realistic physical reflections, especially for metals.

### 2. PBR Road & Park Floors
*   **Asphalt:** The outer road perimeter has been converted from a plain dark grey color to a `PBRMaterial`. I've applied an asphalt Albedo (color) texture along with a matching bump map to give the road a gravelly, uneven look.
*   **Park Concrete:** The central park floor is now a PBR concrete surface instead of plain green. 
*   **Tiling Adjustments:** Both the road and park textures have their `uScale` and `vScale` heavily adjusted (e.g., scaled by 15-20x) so that the texture repeats correctly across the massive surface area without stretching into a blurry mess.

### 3. PBR Cover Objects
*   **Wooden Crates:** The orange boxes are now wooden crates! They use a highly rough, non-metallic PBR material paired with a wood grain albedo texture.
*   **Metal Barrels:** The grey cylinders are now explicitly defined as highly metallic (1.0) with a rusted metal texture map, a metallic mask, and a rough surface bump map. They will realistically reflect the sky and light sources!

## Verification
1.  Open the browser to view the game.
2.  Look down at the ground—you should immediately notice the detailed texture of the concrete and the asphalt roads.
3.  Walk up to one of the cylinders; as you move the camera, watch how the light naturally glints and reflects off the metallic surface compared to the matte finish of the wooden crates.
