import { Scene, ShadowGenerator, MeshBuilder, PBRMaterial, Color3, PhysicsAggregate, PhysicsShapeType, Texture, Vector3, StandardMaterial } from "@babylonjs/core";
import { generateBuilding } from "./BuildingGenerator";

export function parseMap(scene: Scene, shadowGenerator: ShadowGenerator | undefined, blueprint: string[]) {
    const TILE_SIZE = 3;
    const rows = blueprint.length;
    const cols = blueprint[0].length;
    
    // Calculate total size to center the map at (0,0)
    const mapWidth = cols * TILE_SIZE;
    const mapDepth = rows * TILE_SIZE;
    const startX = -mapWidth / 2 + TILE_SIZE / 2;
    const startZ = mapDepth / 2 - TILE_SIZE / 2;

    // Expand the ground to fit the new map sizes
    const groundSize = Math.max(200, Math.max(mapWidth, mapDepth) + 40);
    const ground = MeshBuilder.CreateGround("ground", { width: groundSize, height: groundSize }, scene);
    ground.checkCollisions = true;
    
    const roadMat = new PBRMaterial("roadMat", scene);
    roadMat.albedoColor = new Color3(0.15, 0.15, 0.15); // Dark asphalt
    roadMat.metallic = 0.0;
    roadMat.roughness = 0.9;
    const roadAlbedo = new Texture("https://playground.babylonjs.com/textures/floor.png", scene);
    roadAlbedo.uScale = groundSize / 5;
    roadAlbedo.vScale = groundSize / 5;
    const roadBump = new Texture("https://playground.babylonjs.com/textures/floor_bump.PNG", scene);
    roadBump.uScale = groundSize / 5;
    roadBump.vScale = groundSize / 5;
    roadMat.albedoTexture = roadAlbedo;
    roadMat.bumpTexture = roadBump;
    ground.material = roadMat;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
    ground.receiveShadows = true;

    // Cover Templates
    const concreteMat = new PBRMaterial("concreteMat", scene);
    concreteMat.albedoColor = new Color3(0.7, 0.7, 0.7);
    concreteMat.roughness = 0.8;
    concreteMat.metallic = 0.0;
    concreteMat.albedoTexture = new Texture("https://playground.babylonjs.com/textures/floor.png", scene);
    
    const crateTemplate = MeshBuilder.CreateBox("crate", { size: 2 }, scene);
    crateTemplate.material = concreteMat;
    crateTemplate.position.y = -100;
    
    const blockTemplate = MeshBuilder.CreateBox("block", { width: 4, height: 1.5, depth: 1 }, scene);
    blockTemplate.material = concreteMat;
    blockTemplate.position.y = -100;

    // Lamp Template
    const lampMat = new PBRMaterial("lampMat", scene);
    lampMat.albedoColor = new Color3(0.2, 0.2, 0.2);
    lampMat.metallic = 1.0;
    lampMat.roughness = 0.4;
    
    let spawnPoints: Vector3[] = [];
    let propIndex = 0;

    // We will use a greedy meshing approach to combine adjacent identical building blocks 
    // into larger rectangles to minimize the number of generateBuilding calls and physics bodies.
    const visited = new Set<string>();
    let buildingIndex = 1;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const char = blueprint[r][c];
            const worldX = startX + (c * TILE_SIZE);
            const worldZ = startZ - (r * TILE_SIZE); // Z goes down as row increases

            // Handle Props and Spawns
            if (char === 'C' || char === 'B') {
                const isCrate = Math.random() > 0.5;
                const clone = isCrate ? crateTemplate.createInstance("cover_" + propIndex) : blockTemplate.createInstance("cover_" + propIndex);
                clone.position.x = worldX;
                clone.position.z = worldZ;
                clone.position.y = isCrate ? 1 : 0.75;
                clone.rotation.y = Math.random() * Math.PI;
                if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
                clone.receiveShadows = true;
                new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
                propIndex++;
            } else if (char === 'L') {
                const pole = MeshBuilder.CreateCylinder("lampPole_" + propIndex, { diameter: 0.2, height: 6 }, scene);
                pole.position = new Vector3(worldX, 3, worldZ);
                pole.material = lampMat;
                new PhysicsAggregate(pole, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);
                
                const lightBulb = MeshBuilder.CreateSphere("lightBulb_" + propIndex, { diameter: 0.6 }, scene);
                lightBulb.position = new Vector3(worldX, 6, worldZ);
                const emissiveMat = new StandardMaterial("emissiveMat", scene);
                emissiveMat.emissiveColor = new Color3(1, 0.9, 0.6);
                emissiveMat.disableLighting = true;
                lightBulb.material = emissiveMat;
                propIndex++;
            } else if (char === 'S' || char === 'T' || char === 'A') {
                spawnPoints.push(new Vector3(worldX, 5, worldZ));
            }

            // Handle Buildings (Greedy Meshing)
            if ((char === '1' || char === '2' || char === '3') && !visited.has(`${r},${c}`)) {
                // Find width of this block
                let w = 1;
                while (c + w < cols && blueprint[r][c + w] === char && !visited.has(`${r},${c + w}`)) {
                    w++;
                }

                // Find height (depth) of this block
                let h = 1;
                let canExpandHeight = true;
                while (r + h < rows && canExpandHeight) {
                    for (let i = 0; i < w; i++) {
                        if (blueprint[r + h][c + i] !== char || visited.has(`${r + h},${c + i}`)) {
                            canExpandHeight = false;
                            break;
                        }
                    }
                    if (canExpandHeight) h++;
                }

                // Mark all covered tiles as visited
                for (let ir = 0; ir < h; ir++) {
                    for (let ic = 0; ic < w; ic++) {
                        visited.add(`${r + ir},${c + ic}`);
                    }
                }

                // Calculate center of this rectangle block
                // Local center in tiles:
                const cx = c + (w / 2) - 0.5;
                const cz = r + (h / 2) - 0.5;
                const bWorldX = startX + (cx * TILE_SIZE);
                const bWorldZ = startZ - (cz * TILE_SIZE);

                // Heights: 1 = 15 tiles, 2 = 12 tiles, 3 = 8 tiles
                let heightTiles = 15;
                if (char === '2') heightTiles = 12;
                if (char === '3') heightTiles = 8;

                // Pick a facing direction towards center to put the neon sign
                const faceDir = new Vector3(bWorldX > 0 ? -1 : 1, 0, 0);

                generateBuilding(
                    buildingIndex++, 
                    w, h, heightTiles, 
                    bWorldX, bWorldZ, 
                    faceDir, 
                    scene, 
                    shadowGenerator,
                    true // disable signs for performance at runtime
                );
            }
        }
    }
    
    // Store spawn points globally so NetworkManager/PlayerSystem can use them if needed.
    (window as any).mapSpawnPoints = spawnPoints;
}
