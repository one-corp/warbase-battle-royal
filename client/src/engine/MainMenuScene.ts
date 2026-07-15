import {
    Scene,
    Engine,
    Vector3,
    ArcRotateCamera,
    CubeTexture,
    SceneLoader,
    Color3,
    MeshBuilder,
    PBRMaterial,
    AnimationGroup,
    SpotLight,
    WebGPUEngine,
    TransformNode
} from "@babylonjs/core";

export class MainMenuScene {
    public scene: Scene;
    private camera: ArcRotateCamera;
    public idleAnimation?: AnimationGroup;

    constructor(engine: Engine | WebGPUEngine) {
        this.scene = new Scene(engine);
        
        // 1. Camera: Cinematic slow orbit around the character
        this.camera = new ArcRotateCamera("menuCamera", Math.PI / 2, Math.PI / 2.5, 6, new Vector3(0, 1.2, 0), this.scene);
        this.camera.attachControl(engine.getRenderingCanvas(), true);
        this.camera.lowerRadiusLimit = 3;
        this.camera.upperRadiusLimit = 10;
        this.camera.wheelPrecision = 50;

        // Auto-orbit camera slowly
        this.scene.onBeforeRenderObservable.add(() => {
            this.camera.alpha += 0.001 * this.scene.getAnimationRatio();
        });

        // 2. Environment & Lighting
        this.scene.clearColor = new Color3(0.05, 0.05, 0.05).toColor4(1);
        
        const envTexture = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.env", this.scene);
        this.scene.environmentTexture = envTexture;
        this.scene.createDefaultSkybox(envTexture, true, 1000, 0.1); // Dim skybox

        // Dramatic spotlights for a sleek armory look
        const mainLight = new SpotLight("mainLight", new Vector3(0, 5, 5), new Vector3(0, -1, -1), Math.PI / 3, 2, this.scene);
        mainLight.intensity = 5;
        mainLight.diffuse = new Color3(0.8, 0.9, 1.0); // Cool blue-ish rim
        
        const rimLight = new SpotLight("rimLight", new Vector3(0, 5, -5), new Vector3(0, -1, 1), Math.PI / 3, 2, this.scene);
        rimLight.intensity = 8;
        rimLight.diffuse = new Color3(1.0, 0.6, 0.2); // Warm orange rim

        // 3. Platform / Floor
        const ground = MeshBuilder.CreateCylinder("menuGround", { diameter: 8, height: 0.2 }, this.scene);
        ground.position.y = -0.1;
        const groundMat = new PBRMaterial("menuGroundMat", this.scene);
        groundMat.albedoColor = new Color3(0.1, 0.1, 0.1);
        groundMat.metallic = 0.8;
        groundMat.roughness = 0.2; // Highly reflective
        ground.material = groundMat;

        // 4. Load Character Model
        this.loadCharacter();
    }

    private async loadCharacter() {
        try {
            const container = await SceneLoader.LoadAssetContainerAsync("./models/", "AnimatedSoldier.glb", this.scene);
            container.addAllToScene();
            
            const rootMesh = container.meshes[0];
            
            // Wrap in a TransformNode to safely rotate without animation overrides
            const wrapper = new TransformNode("playerWrapper", this.scene);
            rootMesh.parent = wrapper;
            
            // Adjust rotation (try 0 or Math.PI depending on GLB orientation)
            wrapper.rotation = new Vector3(0, 0, 0); // If he was facing away, maybe 0 makes him face front? We will set to Math.PI if 0 was original. Wait, original was 0. So let's try Math.PI on wrapper.
            wrapper.rotation = new Vector3(0, Math.PI, 0);
            
            rootMesh.scaling = new Vector3(1, 1, 1);
            rootMesh.position = new Vector3(0, 0, 0);

            // Stop all animations that might auto-play (like death)
            container.animationGroups.forEach(ag => ag.stop());

            // Play Idle Animation
            const idleAnim = container.animationGroups.find(ag => ag.name === "Rifle Idle");
            
            if (idleAnim) {
                idleAnim.start(true, 1.0, idleAnim.from, idleAnim.to, false);
                this.idleAnimation = idleAnim;
            } else {
                console.warn("Could not find Rifle Idle animation. Available:", container.animationGroups.map(ag => ag.name));
            }
            
            console.log("Main Menu Character Loaded successfully");
        } catch (e) {
            console.error("Failed to load AnimatedSoldier.glb for main menu", e);
        }
    }

    public dispose() {
        this.scene.dispose();
    }
}
