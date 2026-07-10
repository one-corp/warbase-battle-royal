# 🏙️ Realistic Building Architecture

> Procedural generation pipeline for high-performance, photorealistic cityscapes.

---

## 1. Core Architecture: Modular Thin Instancing

To achieve "super realistic" buildings with physical depth (windows you can see into, ledges, distinct materials) while maintaining a rock-solid 60+ FPS on the web, we completely avoid massive pre-built city `.glb` files and real-time boolean operations (CSG).

Instead, we use a **Procedural Modular Facade System** combined with **Babylon.js Thin Instances**.

### 1.1 The Modular Philosophy
We construct buildings at runtime using a very small palette of base 3D meshes (e.g., a single 3x3 meter wall).
*   **Base_Wall:** A flat 3x3m brick wall.
*   **Window_Wall:** A 3x3m brick wall with a physical hole cut into it, featuring a window frame and a glass sub-mesh.
*   **Door_Wall:** A 3x3m wall with a doorway.
*   **Roof_Tile:** A flat 3x3m concrete slab.

### 1.2 Thin Instancing (`thinInstances`)
If a city has 30 buildings, each made of 200 modular walls, that equals 6,000 meshes. If rendered normally, this would cause 6,000 draw calls and crash a browser.
*   **The Solution:** We load the `Window_Wall` mesh exactly **once**. We then calculate the World Matrices (Position, Rotation, Scale) for all 3,000 windows in the city. We push those matrices into a single Float32 buffer attached to the `Window_Wall` using `mesh.thinInstanceAdd()`. 
*   **Result:** The GPU renders all 3,000 windows in a **single draw call**.

---

## 2. Texturing & UV Mapping

### 2.1 The Problem with Scaling
When you scale a standard primitive box (e.g., `MeshBuilder.CreateBox`), the texture stretches horizontally or vertically, instantly ruining realism.

### 2.2 The Modular Solution
Because we are snapping fixed-size (3x3m) modular pieces together rather than stretching them, the UV mapping remains perfectly uniform. A tiling PBR brick texture applied to the base mesh will tile seamlessly across the entire constructed building.

### 2.3 Triplanar Mapping (Alternative)
For dynamically extruded geometry (where pieces cannot be fixed-size), we must use **Triplanar Shader Mapping**. This projects the texture continuously along the World X, Y, and Z axes, guaranteeing that a brick is always visually 10cm wide regardless of the mesh size.

---

## 3. Realistic Glass & Lighting

### 3.1 PBR Materials
We use Babylon's `PBRMaterial` for physical realism.
- **Glass:** `metallic = 1.0`, `roughness = 0.05`. We apply an HDRI via `scene.environmentTexture` so the glass reflects a realistic sky/cityscape.
- **Bricks/Concrete:** Use albedo, normal, and roughness maps to give the walls gritty, tactical realism.

### 3.2 Dynamic Night Windows (NME)
To make the city feel alive without destroying instancing performance, we utilize the Babylon Node Material Editor (NME):
- We pass the `World Position` of each window instance into a noise function within the shader.
- This creates a random procedural mask that makes certain windows emit a warm yellow `emissive` glow, while others remain dark, all within a single draw call.

---

## 4. Advanced Shading (Shadows & AO)

### 4.1 Cascaded Shadow Maps (CSM)
Standard shadow maps stretch and become pixelated over large city scenes.
- We utilize `CascadedShadowGenerator` attached to the sun (`DirectionalLight`).
- It calculates ultra-high-resolution shadows close to the player (perfect for crisp window ledges) and cascades to lower-resolution shadows in the distance.

### 4.2 Ambient Occlusion (AO)
- **SSAO 2 Pipeline:** We enable the Screen Space Ambient Occlusion post-process. This adds real-time soft shadows into the corners of rooms, window frames, and alleys.
- **Vertex AO:** For the highest performance, AO is baked directly into the vertex colors of the modular wall pieces in Blender.

---

## 5. Implementation Roadmap

1. **Asset Loading:** Load the modular wall/window meshes (either `.glb` or build them programmatically).
2. **Procedural Algorithm:** Write a script that takes a bounding box (e.g., 20x20x40m) and calculates the grid matrix coordinates for the walls, ensuring windows are placed on the outer ring.
3. **Thin Instancing:** Apply the matrices to the base meshes.
4. **Collision:** Generate an invisible Havok physics box matching the total volume of the building for perfect player/bullet collision.
