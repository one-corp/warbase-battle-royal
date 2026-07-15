import * as fs from 'fs';
import * as path from 'path';

// We just copy the blueprints directly here so we don't have to deal with TS module resolution issues in node
import { cityBlueprint } from "../src/engine/CityBlueprint";
import { bulletForceCityBlueprint } from "../src/engine/BulletForceCityBlueprint";

function compileToCode(blueprint: string[], mapName: string, outFileName: string) {
    const TILE_SIZE = 3;
    const rows = blueprint.length;
    const cols = blueprint[0].length;
    const offsetX = (cols * TILE_SIZE) / 2;
    const offsetZ = (rows * TILE_SIZE) / 2;

    let code = `// @ts-nocheck\nimport { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core";\n`;
    code += `import { generateBuilding } from "./BuildingGenerator";\n\n`;
    
    code += `export function build${mapName}Map(scene: Scene, shadowGenerator: any, crateTemplate: any, blockTemplate: any, lampMat: any) {\n`;
    
    code += `    // Generated Code - Do not edit manually\n`;
    
    let propIndex = 0;
    let buildingIndex = 0;
    const visited = new Set<string>();

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const char = blueprint[r][c];
            if (char === ' ') continue;

            const worldX = (c * TILE_SIZE) - offsetX;
            const worldZ = (r * TILE_SIZE) - offsetZ;

            // Handle Props and Spawns
            if (char === 'C' || char === 'B') {
                code += `    {\n`;
                code += `        const isCrate = Math.random() > 0.5;\n`;
                code += `        const clone = isCrate ? crateTemplate.createInstance("cover_${propIndex}") : blockTemplate.createInstance("cover_${propIndex}");\n`;
                code += `        clone.position.x = ${worldX};\n`;
                code += `        clone.position.z = ${worldZ};\n`;
                code += `        clone.position.y = isCrate ? 1 : 0.75;\n`;
                code += `        clone.rotation.y = Math.random() * Math.PI;\n`;
                code += `        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);\n`;
                code += `        clone.receiveShadows = true;\n`;
                code += `        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);\n`;
                code += `    }\n`;
                propIndex++;
            } else if (char === 'L') {
                code += `    {\n`;
                code += `        const pole = MeshBuilder.CreateCylinder("lampPole_${propIndex}", { diameter: 0.2, height: 6 }, scene);\n`;
                code += `        pole.position = new Vector3(${worldX}, 3, ${worldZ});\n`;
                code += `        pole.material = lampMat;\n`;
                code += `        new PhysicsAggregate(pole, PhysicsShapeType.CYLINDER, { mass: 0 }, scene);\n`;
                code += `        const lightBulb = MeshBuilder.CreateSphere("lightBulb_${propIndex}", { diameter: 0.6 }, scene);\n`;
                code += `        lightBulb.position = new Vector3(${worldX}, 6, ${worldZ});\n`;
                code += `        const emissiveMat = new StandardMaterial("emissiveMat", scene);\n`;
                code += `        emissiveMat.emissiveColor = new Color3(1, 0.9, 0.6);\n`;
                code += `        emissiveMat.disableLighting = true;\n`;
                code += `        lightBulb.material = emissiveMat;\n`;
                code += `    }\n`;
                propIndex++;
            } else if (char === 'S' || char === 'T' || char === 'A') {
                // Spawns handled dynamically, skip for mesh generation
                continue;
            } else if (!visited.has(`${r},${c}`)) {
                // Number means building height
                const heightTiles = parseInt(char, 10);
                if (isNaN(heightTiles)) continue;

                // Greedy Meshing
                let w = 1;
                while (c + w < cols && blueprint[r][c + w] === char && !visited.has(`${r},${c + w}`)) {
                    w++;
                }

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

                for (let i = 0; i < h; i++) {
                    for (let j = 0; j < w; j++) {
                        visited.add(`${r + i},${c + j}`);
                    }
                }

                // Calculate center
                const centerTileC = c + w / 2 - 0.5;
                const centerTileR = r + h / 2 - 0.5;
                const bWorldX = (centerTileC * TILE_SIZE) - offsetX;
                const bWorldZ = (centerTileR * TILE_SIZE) - offsetZ;

                let faceDir = { x: 0, y: 0, z: -1 };
                if (w > h) faceDir = { x: 0, y: 0, z: -1 }; // Wider: face south
                else faceDir = { x: 1, y: 0, z: 0 }; // Taller/Square: face east

                code += `    generateBuilding(${buildingIndex++}, ${w}, ${h}, ${heightTiles}, ${bWorldX}, ${bWorldZ}, new Vector3(${faceDir.x}, ${faceDir.y}, ${faceDir.z}), scene, shadowGenerator, true);\n`;
            }
        }
    }
    
    code += `}\n`;
    
    fs.writeFileSync(path.join(process.cwd(), "src/engine", outFileName), code);
    console.log(`Generated ${outFileName}`);
}

compileToCode(cityBlueprint, "Dust2", "Dust2Map.ts");
compileToCode(bulletForceCityBlueprint, "BulletForce", "BulletForceMap.ts");
