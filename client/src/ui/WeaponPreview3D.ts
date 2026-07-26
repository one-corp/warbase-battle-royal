import { 
    Engine, Scene, Vector3, ArcRotateCamera, HemisphericLight, 
    DirectionalLight, Color3, CubeTexture, TransformNode 
} from "@babylonjs/core";
import { AK47Builder } from "../physics/AK47Builder";
import { PistolBuilder } from "../physics/PistolBuilder";
import { M2010Builder } from "../physics/M2010Builder";

export class WeaponPreview3D {
    private engine: Engine;
    private scene: Scene;
    private camera: ArcRotateCamera;
    private currentWeaponNode?: TransformNode;

    constructor(canvas: HTMLCanvasElement) {
        this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
        this.scene = new Scene(this.engine);
        this.scene.clearColor = new Color3(0.04, 0.05, 0.07).toColor4(0.85);

        // Lighting
        const hemiLight = new HemisphericLight("previewHemi", new Vector3(0, 1, 0), this.scene);
        hemiLight.intensity = 1.2;

        const dirLight = new DirectionalLight("previewDir", new Vector3(-1, -2, -1), this.scene);
        dirLight.intensity = 1.5;
        dirLight.diffuse = new Color3(1, 0.9, 0.8);

        // Environment reflection for PBR materials
        try {
            const pbrEnv = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/country.env", this.scene);
            this.scene.environmentTexture = pbrEnv;
            this.scene.environmentIntensity = 0.8;
        } catch (e) {}

        // Orbit Camera
        this.camera = new ArcRotateCamera("previewCam", Math.PI / 2, Math.PI / 2.4, 2.2, new Vector3(0, 0, 0), this.scene);
        this.camera.lowerRadiusLimit = 1.0;
        this.camera.upperRadiusLimit = 5.0;

        // Auto-rotation render loop
        this.scene.onBeforeRenderObservable.add(() => {
            if (this.currentWeaponNode) {
                this.currentWeaponNode.rotation.y += 0.008;
            }
        });

        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    public setWeapon(weaponId: string) {
        if (this.currentWeaponNode) {
            this.currentWeaponNode.dispose();
            this.currentWeaponNode = undefined;
        }

        if (weaponId === "ak47") {
            const ak = AK47Builder.Build(this.scene);
            ak.scaling = new Vector3(0.85, 0.85, 0.85);
            ak.position = new Vector3(0, -0.05, 0);
            this.camera.target = new Vector3(0, 0.02, 0);
            this.camera.radius = 1.8;
            this.currentWeaponNode = ak;
        } else if (weaponId === "m2010") {
            const m2010 = M2010Builder.Build(this.scene);
            m2010.scaling = new Vector3(0.75, 0.75, 0.75);
            m2010.position = new Vector3(0, -0.04, 0);
            this.camera.target = new Vector3(0, 0.02, 0);
            this.camera.radius = 1.6;
            this.currentWeaponNode = m2010;
        } else if (weaponId === "pistol") {
            const pistol = PistolBuilder.Build(this.scene);
            pistol.scaling = new Vector3(1.2, 1.2, 1.2);
            pistol.position = new Vector3(0, -0.05, 0);
            this.camera.target = new Vector3(0, 0.02, 0);
            this.camera.radius = 1.2;
            this.currentWeaponNode = pistol;
        }
    }

    public pause() {
        this.engine.stopRenderLoop();
    }

    public resume() {
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    public dispose() {
        this.engine.stopRenderLoop();
        this.scene.dispose();
        this.engine.dispose();
    }
}
