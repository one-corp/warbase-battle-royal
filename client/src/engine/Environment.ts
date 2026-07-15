import {
    Scene,
    Vector3,
    MeshBuilder,
    Color3,
    PhysicsAggregate,
    PhysicsShapeType,
    ShadowGenerator,
    PBRMaterial,
    Texture,
    StandardMaterial,
    SceneLoader
} from "@babylonjs/core";
import { generateBuilding } from "./BuildingGenerator";
import { buildDust2Map } from "./Dust2Map";
import { buildBulletForceMap } from "./BulletForceMap";

export class EnvironmentManager {
    private scene: Scene;
    private shadowGenerator?: ShadowGenerator;
    private mapChoice: string;

    constructor(scene: Scene, shadowGenerator?: ShadowGenerator, mapChoice: string = "original") {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.mapChoice = mapChoice;
    }

    public async init() {
        // 2. Create Ground (Asphalt/Roads)
        const ground = MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, this.scene);
        ground.checkCollisions = true;
        
        const roadMat = new PBRMaterial("roadMat", this.scene);
        roadMat.albedoColor = new Color3(0.15, 0.15, 0.15); // Dark asphalt
        roadMat.metallic = 0.0;
        roadMat.roughness = 0.9;
        const roadAlbedo = new Texture("https://playground.babylonjs.com/textures/floor.png", this.scene);
        roadAlbedo.uScale = 40;
        roadAlbedo.vScale = 40;
        const roadBump = new Texture("https://playground.babylonjs.com/textures/floor_bump.PNG", this.scene);
        roadBump.uScale = 40;
        roadBump.vScale = 40;
        roadMat.albedoTexture = roadAlbedo;
        roadMat.bumpTexture = roadBump;
        ground.material = roadMat;

        // Add static physics to ground
        new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        ground.receiveShadows = true;

        // 4. Props, Cover, and Lamp Posts
        const concreteMat = new PBRMaterial("concreteMat", this.scene);
        concreteMat.albedoColor = new Color3(0.7, 0.7, 0.7);
        concreteMat.roughness = 0.8;
        concreteMat.metallic = 0.0;
        concreteMat.albedoTexture = new Texture("https://playground.babylonjs.com/textures/floor.png", this.scene);
        
        const woodMat = new PBRMaterial("woodMat", this.scene);
        woodMat.albedoColor = new Color3(0.6, 0.4, 0.2); // Wood brown
        woodMat.roughness = 0.9;
        woodMat.metallic = 0.0;
        woodMat.albedoTexture = new Texture("https://playground.babylonjs.com/textures/wood.jpg", this.scene);

        // Create basic cover templates
        const crateTemplate = MeshBuilder.CreateBox("crate", { size: 2 }, this.scene);
        crateTemplate.material = woodMat;
        crateTemplate.position.y = -100;
        
        const blockTemplate = MeshBuilder.CreateBox("block", { width: 4, height: 1.5, depth: 1 }, this.scene);
        blockTemplate.material = concreteMat;
        blockTemplate.position.y = -100;
        
        const lampMat = new PBRMaterial("lampMat", this.scene);
        lampMat.albedoColor = new Color3(0.2, 0.2, 0.2);
        lampMat.metallic = 1.0;
        lampMat.roughness = 0.4;

        if (this.mapChoice === "industrial") {
            await this.loadGLBMap("low_poly_industrial_zone.glb");
            return;
        } else if (this.mapChoice === "dust2") {
            buildDust2Map(this.scene, this.shadowGenerator, crateTemplate, blockTemplate, lampMat);
            return;
        } else if (this.mapChoice === "bulletforce") {
            buildBulletForceMap(this.scene, this.shadowGenerator, crateTemplate, blockTemplate, lampMat);
            return;
        }

        // Original Map 
        // Tower 1 (Player Spawn / Central Hub)
        generateBuilding(1, 30, 20, 10, 0, 0, new Vector3(0, 0, -1), this.scene, this.shadowGenerator, true);
        
        // Spawn cover scattered around the central plaza (-15 to 15)
        for (let i = 0; i < 40; i++) {
            const isCrate = Math.random() > 0.5;
            const clone = isCrate ? crateTemplate.createInstance("cover_" + i) : blockTemplate.createInstance("cover_" + i);
            
            const x = (Math.random() - 0.5) * 30; // within plaza
            const z = (Math.random() - 0.5) * 30; // within plaza
            
            // Keep absolute center completely clear for chaos
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
            
            clone.position.x = x;
            clone.position.z = z;
            clone.position.y = isCrate ? 1 : 0.75;
            clone.rotation.y = Math.random() * Math.PI;
            
            if (this.shadowGenerator) this.shadowGenerator.addShadowCaster(clone, true);
            clone.receiveShadows = true;
            new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
        }

        // Generate Random Lamp Posts
        const spawnLamp = (x: number, z: number) => {
            const pole = MeshBuilder.CreateCylinder("lampPole", { diameter: 0.2, height: 6 }, this.scene);
            pole.position = new Vector3(x, 3, z);
            pole.material = lampMat;
            new PhysicsAggregate(pole, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
            
            const lightBulb = MeshBuilder.CreateSphere("lightBulb", { diameter: 0.6 }, this.scene);
            lightBulb.position = new Vector3(x, 6, z);
            const emissiveMat = new StandardMaterial("emissiveMat", this.scene);
            emissiveMat.emissiveColor = new Color3(1, 0.9, 0.6);
            emissiveMat.disableLighting = true;
            lightBulb.material = emissiveMat;
        };

        // Randomly place a few lamps in the corridors and plaza edges
        for (let i = 0; i < 10; i++) {
            // Pick a spot along the corridor edges or plaza edges
            let x = 0, z = 0;
            if (Math.random() > 0.5) {
                // Corridor
                x = (Math.random() > 0.5 ? 1 : -1) * 8; // Edge of the 9m wide corridor
                z = (Math.random() > 0.5 ? 1 : -1) * (20 + Math.random() * 30);
            } else {
                // Plaza
                x = (Math.random() - 0.5) * 32;
                z = (Math.random() > 0.5 ? 1 : -1) * 16;
            }
            spawnLamp(x, z);
        }
    }

    private async loadGLBMap(filename: string) {
        try {
            console.log(`Loading external map: ${filename}...`);
            const container = await SceneLoader.LoadAssetContainerAsync("./maps/", filename, this.scene);
            
            // Strip any built-in cameras or lights from the GLB so they don't ruin our scene's carefully tuned lighting & camera setup
            container.cameras = [];
            container.lights = [];
            
            container.addAllToScene();
            
            console.log(`Successfully loaded map meshes:`, container.meshes.length);

            container.meshes.forEach((mesh) => {
                if (!mesh) return;
                
                // Add to shadow generator
                if (this.shadowGenerator && mesh.name !== "__root__") {
                    this.shadowGenerator.addShadowCaster(mesh, true);
                    mesh.receiveShadows = true;
                }

                // Add physics hitboxes (only for visible geometry, skipping pure transforms/bones)
                // In babylon, geometry is usually on meshes with getTotalVertices() > 0
                if (mesh.getTotalVertices() > 0) {
                    try {
                        new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0, friction: 0.5, restitution: 0 }, this.scene);
                    } catch (e) {
                        console.warn(`Failed to create physics for ${mesh.name}:`, e);
                    }
                }
            });

            // If the map comes with animations (moving platforms etc.), play them
            container.animationGroups.forEach(ag => ag.play(true));
            
        } catch (e) {
            console.error(`Failed to load external map: ${filename}`, e);
        }
    }
}
