import {
    Scene,
    MeshBuilder,
    Color3,
    PhysicsAggregate,
    PhysicsShapeType,
    ShadowGenerator,
    PBRMaterial,
    Texture,
    SceneLoader
} from "@babylonjs/core";

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
        // 2. Create Fallback Ground (Asphalt/Roads) - placed slightly below 0 to prevent z-fighting with GLB maps
        const ground = MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, this.scene);
        ground.position.y = -0.5;
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

        if (this.mapChoice === "industrial") {
            await this.loadGLBMap("low_poly_industrial_zone.glb");
        } else if (this.mapChoice === "village") {
            await this.loadGLBMap("Village.glb");
        } else {
            await this.loadGLBMap("low_poly_industrial_zone.glb");
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
