import {
    Scene,
    Vector3,
    MeshBuilder,
    Color3,
    PhysicsAggregate,
    PhysicsShapeType,
    ShadowGenerator,
    PBRMaterial,
    Texture
} from "@babylonjs/core";
import { generateBuilding } from "./BuildingGenerator";

export function setupEnvironment(scene: Scene, shadowGenerator?: ShadowGenerator) {
    // The environment texture and skybox are now handled centrally in main.ts

    // 2. Create Ground (Asphalt/Roads)
    const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    ground.checkCollisions = true;
    
    const roadMat = new PBRMaterial("roadMat", scene);
    roadMat.albedoColor = new Color3(0.2, 0.2, 0.2);
    roadMat.metallic = 0.1;
    roadMat.roughness = 0.8;
    const roadAlbedo = new Texture("https://playground.babylonjs.com/textures/floor.png", scene);
    roadAlbedo.uScale = 20;
    roadAlbedo.vScale = 20;
    const roadBump = new Texture("https://playground.babylonjs.com/textures/floor_bump.PNG", scene);
    roadBump.uScale = 20;
    roadBump.vScale = 20;
    roadMat.albedoTexture = roadAlbedo;
    roadMat.bumpTexture = roadBump;
    ground.material = roadMat;

    // Add static physics to ground
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);

    // 3. Central Park Ground
    const parkGround = MeshBuilder.CreateGround("parkGround", { width: 50, height: 50 }, scene);
    parkGround.position.y = 0.05; // Slightly above road to prevent Z-fighting
    
    const parkMat = new PBRMaterial("parkMat", scene);
    parkMat.albedoColor = new Color3(0.3, 0.4, 0.25);
    parkMat.metallic = 0.0;
    parkMat.roughness = 0.9;
    const parkAlbedo = new Texture("https://playground.babylonjs.com/textures/grass.jpg", scene);
    parkAlbedo.uScale = 15;
    parkAlbedo.vScale = 15;
    parkMat.albedoTexture = parkAlbedo;
    parkGround.material = parkMat;

    // Shadows are handled centrally in main.ts using CascadedShadowGenerator
    ground.receiveShadows = true;
    parkGround.receiveShadows = true;

    // 2. Map Layout: Enclosing Perimeter Buildings
    const perimeterSize = 41; // Road goes up to 35, buildings centered at 41
    const buildingSpacing = 12; // 4 tiles * 3m = 12m

    let buildingIndex = 1;

    // Generate solid wall of buildings on all 4 sides
    const spawnBuildingEdge = (x: number, z: number, faceDirection: Vector3) => {
        const heightTiles = 5 + Math.floor(Math.random() * 8); // 5 to 12 floors
        const widthTiles = 4; // Constant width so they snap perfectly
        const depthTiles = 4; 
        generateBuilding(buildingIndex++, widthTiles, depthTiles, heightTiles, x, z, faceDirection, scene, shadowGenerator);
    };

    // Top & Bottom Walls
    for (let x = -perimeterSize; x <= perimeterSize; x += buildingSpacing) {
        spawnBuildingEdge(x, perimeterSize, new Vector3(0, 0, -1)); // Top faces -Z
        spawnBuildingEdge(x, -perimeterSize, new Vector3(0, 0, 1)); // Bottom faces +Z
    }

    // Left & Right Walls (Avoid corners)
    for (let z = -perimeterSize + buildingSpacing; z <= perimeterSize - buildingSpacing; z += buildingSpacing) {
        spawnBuildingEdge(-perimeterSize, z, new Vector3(1, 0, 0)); // Left faces +X
        spawnBuildingEdge(perimeterSize, z, new Vector3(-1, 0, 0)); // Right faces -X
    }

    // 1.5 Park Cover / Obstacles (Showcasing Babylon Primitives)
    // Create Materials
    const woodMat = new PBRMaterial("woodMat", scene);
    woodMat.albedoColor = new Color3(0.6, 0.4, 0.2); // Wood brown
    woodMat.roughness = 0.9;
    woodMat.metallic = 0.0;
    woodMat.albedoTexture = new Texture("https://playground.babylonjs.com/textures/wood.jpg", scene);
    
    const concreteMat = new PBRMaterial("concreteMat", scene);
    concreteMat.albedoColor = new Color3(0.7, 0.7, 0.7); // Concrete grey
    concreteMat.roughness = 0.8;
    concreteMat.metallic = 0.0;
    concreteMat.albedoTexture = new Texture("https://playground.babylonjs.com/textures/floor.png", scene);
    concreteMat.bumpTexture = new Texture("https://playground.babylonjs.com/textures/floor_bump.PNG", scene);
    
    const metalMat = new PBRMaterial("metalMat", scene);
    metalMat.albedoColor = new Color3(0.4, 0.4, 0.45);
    metalMat.metallic = 1.0;
    metalMat.roughness = 0.3;
    
    // Create Templates
    const crateTemplate = MeshBuilder.CreateBox("crate", { size: 2 }, scene);
    crateTemplate.material = woodMat;
    crateTemplate.position.y = 1;
    
    const blockTemplate = MeshBuilder.CreateBox("block", { width: 4, height: 1.5, depth: 1 }, scene);
    blockTemplate.material = concreteMat;
    blockTemplate.position.y = 0.75;
    
    const barrelTemplate = MeshBuilder.CreateCylinder("barrel", { diameter: 1, height: 1.5 }, scene);
    barrelTemplate.material = metalMat;
    barrelTemplate.position.y = 0.75;
    
    const sphereTemplate = MeshBuilder.CreateSphere("sphereCover", { diameter: 3 }, scene);
    sphereTemplate.material = concreteMat;
    sphereTemplate.position.y = 1.5;
    
    const templates = [crateTemplate, blockTemplate, barrelTemplate, sphereTemplate];
    
    // Hide templates out of bounds so we can clone them
    templates.forEach(t => t.position.y = -100);
    
    // Spawn random obstacles in the park
    for (let i = 0; i < 60; i++) {
        const x = (Math.random() - 0.5) * 45; // Inside 50x50 park
        const z = (Math.random() - 0.5) * 45;
        
        // Keep clear path in middle for combat
        if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
        
        // Pick random template
        const template = templates[Math.floor(Math.random() * templates.length)];
        const clone = template.createInstance("obstacle_" + i);
        
        clone.position.x = x;
        clone.position.z = z;
        clone.position.y = template.name === "crate" ? 1 : (template.name === "block" || template.name === "barrel" ? 0.75 : 1.5);
        clone.rotation.y = Math.random() * Math.PI;
        
        if (shadowGenerator) {
            shadowGenerator.addShadowCaster(clone, true);
        }
        clone.receiveShadows = true;
        
        // Add Physics Hitbox
        let shape = PhysicsShapeType.BOX;
        if (template.name === "barrel") shape = PhysicsShapeType.CYLINDER;
        if (template.name === "sphereCover") shape = PhysicsShapeType.SPHERE;
        
        new PhysicsAggregate(clone, shape, { mass: 0 }, scene);
    }

    const crateMat = new PBRMaterial("crateMat", scene);
    crateMat.albedoColor = new Color3(0.8, 0.4, 0.1);
    crateMat.roughness = 0.9;
    crateMat.metallic = 0.0;
    crateMat.albedoTexture = new Texture("https://playground.babylonjs.com/textures/wood.jpg", scene);

    const dynamicCrateTemplate = MeshBuilder.CreateBox("dynamic_crate_template", { size: 2 }, scene);
    dynamicCrateTemplate.material = crateMat;
    dynamicCrateTemplate.position.y = -100; // hide it

    for (let i = 0; i < 20; i++) {
        const crate = dynamicCrateTemplate.createInstance(`crate_${i}`);
        
        crate.position.x = (Math.random() - 0.5) * 40;
        crate.position.z = (Math.random() - 0.5) * 40;
        crate.position.y = 10 + Math.random() * 10; // Drop from sky

        crate.checkCollisions = true;
        if (shadowGenerator) {
            shadowGenerator.addShadowCaster(crate, true);
        }

        // Dynamic physics for crates (wood is heavy and not bouncy)
        new PhysicsAggregate(crate, PhysicsShapeType.BOX, { mass: 20, restitution: 0.1, friction: 0.8 }, scene);
    }
}
