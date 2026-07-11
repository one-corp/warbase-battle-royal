import {
    Scene,
    Vector3,
    MeshBuilder,
    PBRMaterial,
    Color3,
    Matrix,
    Mesh,
    PhysicsAggregate,
    PhysicsShapeType,
    CSG,
    ShadowGenerator,
    Texture,
    DynamicTexture,
    StandardMaterial,
    PointLight
} from "@babylonjs/core";

let wallTemplate: Mesh;
let windowTemplate: Mesh;
let glassTemplate: Mesh;
let roofTemplate: Mesh;

const TILE_SIZE = 3; // 3x3 meters per modular block

export function initBuildingTemplates(scene: Scene, shadowGenerator?: ShadowGenerator) {
    if (wallTemplate) return; // Already initialized

    // 1. Materials
    const wallMat = new PBRMaterial("wallMat", scene);
    wallMat.albedoColor = new Color3(1, 1, 1); // Reset to pure white for natural concrete color
    wallMat.metallic = 0.0;
    wallMat.roughness = 0.95;
    
    // Add real concrete/rock texture to walls
    const wallAlbedo = new Texture("https://playground.babylonjs.com/textures/floor.png", scene);
    const wallBump = new Texture("https://playground.babylonjs.com/textures/floor_bump.PNG", scene);
    // Scale the texture so it tiles nicely across the 3x3 meter blocks
    wallAlbedo.uScale = 2;
    wallAlbedo.vScale = 4;
    wallBump.uScale = 2;
    wallBump.vScale = 4;
    
    wallMat.albedoTexture = wallAlbedo;
    wallMat.bumpTexture = wallBump;
    
    // Glass Material
    const glassMat = new PBRMaterial("glassMat", scene);
    glassMat.albedoColor = new Color3(0.05, 0.05, 0.05); // Dark tinted glass
    glassMat.metallic = 1.0;  // Fully reflective
    glassMat.roughness = 0.1; // Smooth
    glassMat.alpha = 0.8;     // Slight transparency

    // Roof Material
    const roofMat = new PBRMaterial("roofMat", scene);
    roofMat.albedoColor = new Color3(0.2, 0.2, 0.2); // Dark tar roof
    roofMat.metallic = 0.0;
    roofMat.roughness = 1.0;

    // 2. Base Wall Mesh (Solid)
    wallTemplate = MeshBuilder.CreateBox("wall_template", { width: TILE_SIZE, height: TILE_SIZE, depth: 0.3 }, scene);
    wallTemplate.material = wallMat;
    wallTemplate.alwaysSelectAsActiveMesh = true;
    wallTemplate.receiveShadows = true;

    // 3. Window Wall Mesh (CSG Cutout)
    // Create the outer wall
    const wallOuter = MeshBuilder.CreateBox("outer", { width: TILE_SIZE, height: TILE_SIZE, depth: 0.3 }, scene);
    // Create the "punch" box for the hole
    const windowHole = MeshBuilder.CreateBox("hole", { width: 1.6, height: 2.0, depth: 1.0 }, scene);
    windowHole.position.y = 0.2; // Move window slightly up from floor level

    // Execute CSG boolean subtract
    const wallOuterCSG = CSG.FromMesh(wallOuter);
    const windowHoleCSG = CSG.FromMesh(windowHole);
    const windowWallCSG = wallOuterCSG.subtract(windowHoleCSG);
    
    windowTemplate = windowWallCSG.toMesh("window_template", wallMat, scene);
    windowTemplate.alwaysSelectAsActiveMesh = true;
    windowTemplate.receiveShadows = true;
    
    // Cleanup temporary CSG meshes
    wallOuter.dispose();
    windowHole.dispose();

    // 4. Glass Mesh (Fits inside the hole)
    glassTemplate = MeshBuilder.CreatePlane("glass_template", { width: 1.6, height: 2.0 }, scene);
    glassTemplate.position.y = 0.2; // Match hole offset
    glassTemplate.material = glassMat;
    glassTemplate.alwaysSelectAsActiveMesh = true;
    // We want double sided so we can see it from inside too if we ever enter
    glassTemplate.material.backFaceCulling = false;

    // 5. Roof Mesh
    roofTemplate = MeshBuilder.CreateBox("roof_template", { width: 1, height: 0.2, depth: 1 }, scene);
    roofTemplate.material = roofMat;
    roofTemplate.alwaysSelectAsActiveMesh = true;
    roofTemplate.receiveShadows = true;

    if (shadowGenerator) {
        shadowGenerator.addShadowCaster(wallTemplate, true);
        shadowGenerator.addShadowCaster(windowTemplate, true);
        shadowGenerator.addShadowCaster(roofTemplate, true);
        // glass usually doesn't cast shadows, so we skip it to let light through windows
    }
}

export function generateBuilding(
    index: number,
    widthTiles: number, 
    depthTiles: number, 
    heightTiles: number, 
    positionX: number, 
    positionZ: number, 
    scene: Scene,
    shadowGenerator?: ShadowGenerator
) {
    if (!wallTemplate) initBuildingTemplates(scene, shadowGenerator);

    const wallMatrices: Matrix[] = [];
    const windowMatrices: Matrix[] = [];
    const glassMatrices: Matrix[] = [];

    // Building dimensions
    const width = widthTiles * TILE_SIZE;
    const depth = depthTiles * TILE_SIZE;
    const startX = positionX - width / 2 + TILE_SIZE / 2;
    const startZ = positionZ - depth / 2 + TILE_SIZE / 2;

    for (let y = 0; y < heightTiles; y++) {
        const hY = (y * TILE_SIZE) + (TILE_SIZE / 2);

        // Front & Back walls (along X axis)
        for (let x = 0; x < widthTiles; x++) {
            const isEdge = (x === 0 || x === widthTiles - 1);
            const hasWindow = !isEdge; // All middle columns get windows

            const pX = startX + (x * TILE_SIZE);
            
            // Front (Z = min)
            const pZFront = positionZ - depth / 2;
            const matFront = Matrix.Translation(pX, hY, pZFront);
            if (hasWindow) {
                windowMatrices.push(matFront);
                glassMatrices.push(matFront);
            } else {
                wallMatrices.push(matFront);
            }

            // Back (Z = max)
            const pZBack = positionZ + depth / 2;
            const rotBack = Matrix.RotationY(Math.PI);
            const posBack = Matrix.Translation(pX, hY, pZBack);
            const matBack = rotBack.multiply(posBack);
            if (hasWindow) {
                windowMatrices.push(matBack);
                glassMatrices.push(matBack);
            } else {
                wallMatrices.push(matBack);
            }
        }

        // Left & Right walls (along Z axis)
        for (let z = 0; z < depthTiles; z++) {
            const isEdge = (z === 0 || z === depthTiles - 1);
            const hasWindow = !isEdge; // Edge columns are solid

            const pZ = startZ + (z * TILE_SIZE);

            // Left (X = min)
            const pXLeft = positionX - width / 2;
            const rotLeft = Matrix.RotationY(Math.PI / 2);
            const posLeft = Matrix.Translation(pXLeft, hY, pZ);
            const matLeft = rotLeft.multiply(posLeft);
            if (hasWindow) {
                windowMatrices.push(matLeft);
                glassMatrices.push(matLeft);
            } else {
                wallMatrices.push(matLeft);
            }

            // Right (X = max)
            const pXRight = positionX + width / 2;
            const rotRight = Matrix.RotationY(-Math.PI / 2);
            const posRight = Matrix.Translation(pXRight, hY, pZ);
            const matRight = rotRight.multiply(posRight);
            if (hasWindow) {
                windowMatrices.push(matRight);
                glassMatrices.push(matRight);
            } else {
                wallMatrices.push(matRight);
            }
        }
    }

    // Apply Thin Instances (Massive Performance Gain)
    for (const mat of wallMatrices) wallTemplate.thinInstanceAdd(mat);
    for (const mat of windowMatrices) windowTemplate.thinInstanceAdd(mat);
    for (const mat of glassMatrices) glassTemplate.thinInstanceAdd(mat);

    // Add Roof
    const roofY = heightTiles * TILE_SIZE;
    const roofMat = Matrix.Scaling(width + 0.3, 1, depth + 0.3).multiply(Matrix.Translation(positionX, roofY, positionZ));
    roofTemplate.thinInstanceAdd(roofMat);

    // Create a single Havok Physics Box for the entire building
    const physicsBox = MeshBuilder.CreateBox("building_physics", { width: width, height: roofY, depth: depth }, scene);
    physicsBox.position = new Vector3(positionX, roofY / 2, positionZ);
    physicsBox.isVisible = false; // Invisible physics barrier
    new PhysicsAggregate(physicsBox, PhysicsShapeType.BOX, { mass: 0, friction: 0.5, restitution: 0.0 }, scene);
    // Generate a neon sign for the building number
    const signSize = 2.0;
    const sign = MeshBuilder.CreatePlane(`sign_${index}`, { width: signSize, height: signSize }, scene);
    
    // Position sign on the front wall (facing -Z) near the top or middle
    const signY = Math.max(3, (heightTiles * TILE_SIZE) - 2); 
    sign.position = new Vector3(positionX, signY, positionZ - (depth / 2) - 0.05); // slightly out from the wall
    sign.rotation.y = Math.PI; // Face outwards (-Z)
    
    // Create Emissive Dynamic Texture
    const dt = new DynamicTexture(`dt_${index}`, { width: 512, height: 512 }, scene, false);
    const font = "bold 250px Arial";
    // Draw text: text, x, y, font, text color, background color, invertY
    dt.drawText(index.toString().padStart(2, '0'), null, 350, font, "white", "transparent", true, true);
    
    const signMat = new StandardMaterial(`signMat_${index}`, scene);
    signMat.diffuseTexture = dt;
    signMat.diffuseTexture.hasAlpha = true;
    signMat.emissiveColor = new Color3(1.0, 0.2, 0.2); // Neon red
    signMat.disableLighting = true; // Make it purely glowing, ignoring shadows/lights
    
    sign.material = signMat;
    
    // Add Artificial Lighting (PointLight)
    // We add a light right where the sign is to cast its red glow onto the walls and ground!
    const signLight = new PointLight(`signLight_${index}`, sign.position, scene);
    signLight.diffuse = new Color3(1.0, 0.2, 0.2); // Match neon red
    signLight.specular = new Color3(1.0, 0.2, 0.2);
    signLight.intensity = 0.8;
    signLight.range = 15;
}
