# WebGPU Optimization and Strictness Constraints

## Overview
WebGPU is significantly more strict than WebGL when it comes to memory mapping, pipeline compilation, and shader resource allocation. While WebGL often silently ignores or forgives unoptimized assets, WebGPU will strictly abort render pipelines asynchronously (resulting in a black screen) if hardware limits are exceeded.

When importing complex external GLB maps (like `industrial`), two major WebGPU hardware limits must be carefully managed to prevent silent rendering crashes.

---

## 1. Fragment Shader Interpolator Limits (Varyings)

**The Error:**
`[EntryPoint "main"] infringes limits: Total fragment input variables count (17) exceeds the maximum (16).`

**The Cause:**
WebGPU imposes a strict limit on `maxInterStageShaderComponents` (which translates to the number of variables/vectors passed from the vertex shader to the fragment shader). On many devices (including Apple Silicon Metal backends), this is strictly capped at **16 variables**.
When loading a complex PBR map, Babylon.js automatically assigns varyings for Positions, Normals, Tangents, UV1, UV2, etc. If you enable `CascadedShadowGenerator`, it consumes an additional varying for *each shadow cascade*. This pushes the shader over the 16-variable limit, crashing the `MainRenderPass`.

**The Solution:**
1. **Shadow Maps**: Avoid `CascadedShadowGenerator` in WebGPU unless strictly necessary and tightly optimized. A standard `ShadowGenerator` with a high-resolution map (e.g., 2048x2048) and Percentage Closer Filtering (PCF) provides excellent quality while saving multiple varying slots.
2. **Material Stripping**: Disable unused interpolators on the map's materials. For example, explicitly disabling vertex colors if the map uses textures:
   ```typescript
   if (vertexCount > 0) {
       mesh.useVertexColors = false; // Saves 1 vec4 varying
   }
   ```

**Impact on Visual Quality:**
* **Shadows:** Standard `ShadowGenerator` uses a single shadow map for the entire scene. While it lacks the distance-based dynamic resolution of Cascaded shadows, setting a 2048x2048 map with PCF filtering keeps close-range shadows crisp and realistic with a significant performance boost.
* **Vertex Colors:** 99% of modern PBR assets use Albedo and Normal textures rather than raw vertex painting. Disabling vertex colors has zero impact on visual quality for texture-based maps.

---

## 2. WebGPU Memory Buffer Limits for Physics Shapes

**The Error:**
Asynchronous GPU Validation Error during `Queue.Submit()` related to memory buffers when generating `PhysicsAggregate`.

**The Cause:**
When utilizing `PhysicsShapeType.MESH` for collision detection, the Havok Physics plugin requests Babylon to read the mesh's raw vertex buffers from GPU memory into the CPU's WebAssembly module. If the map consists of a single massive, unoptimized mesh (e.g., over 65,000 vertices), the generated memory mapping buffer exceeds WebGPU's per-buffer limits, crashing the engine.

**The Solution:**
Implement a safety fallback when generating hitboxes. If a mesh exceeds a safe vertex limit, fall back to a mathematically generated bounding volume (`CONVEX_HULL`) instead of a 1:1 raw polygon map.
```typescript
const vertexCount = mesh.getTotalVertices();
if (vertexCount > 65000) {
    new PhysicsAggregate(mesh, PhysicsShapeType.CONVEX_HULL, { mass: 0 }, scene);
} else {
    new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0 }, scene);
}
```

**Impact on Gameplay:**
* **Mesh Physics:** Extremely precise. Players can walk perfectly on stairs and slopes.
* **Convex Hull Fallback:** Wraps the massive mesh in "shrink-wrap" physics. Players will collide accurately with the general shape, but concave areas (like the inside of a hollow tube or tight indoor corridors within that single mesh) might become blocked. To fix this long-term, artists should export maps broken up into multiple smaller meshes rather than one giant unified mesh.
