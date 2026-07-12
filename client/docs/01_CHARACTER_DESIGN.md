# 🎖️ Character Design Blueprint

> The Masked Operator — A high-poly, fully rigged military character for a web-based FPS.

---

## 1. Design Philosophy

The character is a **fully masked military operator** — balaclava + tactical helmet — so we never need to render facial features, teeth, eyes, or hair. This is a massive performance win. The silhouette does all the storytelling.

**Art Direction:** We utilize a high-quality, fully rigged AAA asset (`Soldier.glb`). Detail comes from PBR textures, proper normal mapping, and complex skeletal animations.

---

## 2. Character Anatomy & The `.glb` Asset

We have officially transitioned from procedural primitive shapes to a high-poly rigged model to achieve a AAA FPS feel.

### 2.1 The `Soldier.glb` Asset
We are utilizing the community-standard `Soldier.glb` model. It packages a high-poly mesh, PBR textures, and a full skeletal rig into a single binary file.
- **Embedded Animations:** The file natively comes packaged with perfectly baked skeletal animations: `Idle`, `Walk`, `Run`, and `TPose`.
- **Asynchronous Instancing:** We load the model once into memory using `SceneLoader.LoadAssetContainerAsync`. We then stamp copies of it across all Enemy Bots and the Player Viewmodel using `container.instantiateModelsToScene()`. This ensures we only pay the memory cost of the model once, even if there are 100 bots on screen.

### 2.2 First-Person True Viewmodel Arms (The Player)
The player does not see a floating pair of blocks. We use the full rigged model for the most authentic weapon-holding experience:
- We instance the full `Soldier.glb` as the player's viewmodel.
- It is parented to a `swayRoot` attached to the camera, positioned *behind and below* the camera so that only the arms and torso stretch forward into view.
- The `Idle` animation is constantly looping, giving the player natural hand breathing and swaying.
- **Weapon Attachment:** The primary weapon is rigidly attached directly to the `mixamorig:RightHand` bone using `weaponMesh.attachToBone()`.

### 2.3 Frustum Culling Solution
A major hurdle with rigged models in Babylon.js is Frustum Culling. When the `Soldier` plays animations, its arms swing outside of its pre-calculated invisible bounding box. If that box leaves the screen, the engine deletes the model.
- **The Fix:** We iterate through every sub-mesh of the instanced GLB (`getChildMeshes()`) and set `alwaysSelectAsActiveMesh = true` to force the engine to always render the characters.

### 2.4 WebGL 2 Stability
While WebGPU offers massive draw-call limits, the `WebGPUEngine` crashed silently when attempting to compile shaders for the `Soldier.glb`'s complex bone weights. To maintain perfect stability and compatibility, we execute the character pipeline entirely on the robust **WebGL 2 Engine** (`new Engine()`).

---

## 3. Texture Strategy: PBR-Lite

### 3.1 Compression
Use **KTX2 with Basis Universal** for GPU-compressed textures that stay compressed in VRAM:
- Color textures: `etc1s` compression
- Normal maps (if used): `uastc` compression
- Tool: `gltf-transform` CLI

---

## 4. Military Color Palettes

### 4.1 Urban Ops (Default — matches city map)

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Primary | Black Olive | `#3B3B39` | Vest, helmet |
| Secondary | Granite Gray | `#5D696A` | Pants, sleeves |
| Tertiary | Ash Gray | `#B2C1B9` | Pouch accents |
| Metal | Gunmetal | `#2C3539` | Buckles, NVG |
| Skin (gloves) | Charcoal | `#36454F` | Gloves, mask |

---

## 5. Performance Budget (Per Scene)

### 5.1 Character Budget

| Metric | Per Character | 10 Characters | 16 Characters |
|--------|--------------|---------------|---------------|
| Draw Calls | 1 | 1 (Thin Instancing) | 1 (Thin Instancing) |
| Materials | 1 | 1 (shared) | 1 (shared) |
| Textures | 2 × 1024² | 2 × 1024² (shared) | 2 × 1024² (shared) |
| Bones | ~60 | ~600 | ~960 |

### 5.2 Scene-Wide Budget

| Category | Triangle Budget |
|----------|----------------|
| All Characters (16) | ~150,000 |
| All Weapons (16) | ~16,000 |
| Environment (city) | ~500,000 – 1,000,000 |
| Particles / Effects | ~5,000 |
| **Total** | **~700,000 – 1,200,000** |

### 5.3 Optimization Techniques

| Technique | Impact | When to Use |
|-----------|--------|-------------|
| **Asset Containers** | Only loads GLB into memory once | All GLB loading |
| `material.freeze()` | Eliminates per-frame material updates | All static materials |
| `mesh.freezeWorldMatrix()` | Skips matrix recomputation | Non-moving objects |
| **KTX2 Textures** | 4–8× VRAM savings | All textures in production |
