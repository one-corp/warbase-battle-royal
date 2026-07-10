# Realistic Materials Implementation Tasks

- `[x]` **Lighting and Environment**
    - `[x]` Modify `src/Environment.ts` to load an HDRI environment texture.
    - `[x]` Adjust `HemisphericLight` intensity to balance with HDRI.
- `[x]` **Floor Materials (Park & Roads)**
    - `[x]` Update the park `ground` mesh to use `PBRMaterial`.
    - `[x]` Apply `albedo`, `bump`, and `metallic` textures for concrete to the park floor.
    - `[x]` Adjust UV scaling for the park floor to prevent tiling artifacts.
    - `[x]` Update the `road` meshes to use `PBRMaterial`.
    - `[x]` Apply `albedo`, `bump`, and `metallic` textures for asphalt to the roads.
- `[x]` **Cover Objects (Crates & Blocks)**
    - `[x]` In `src/Environment.ts`, update `createCrate` to use Wood `PBRMaterial`.
    - `[x]` Update `createCrate` (or specific blocks) to use Metal `PBRMaterial`.
- `[ ]` **Testing and Verification**
    - `[ ]` Run build to check for typescript errors.
    - `[ ]` Create Walkthrough artifact.
