import { 
    Scene, 
    TransformNode, 
    MeshBuilder, 
    PBRMaterial, 
    Color3 
} from "@babylonjs/core";

export class PistolBuilder {
    public static Build(scene: Scene): TransformNode {
        const root = new TransformNode("pistol", scene);

        // --- PBR MATERIALS ---
        // Matte Polymer Grip / Frame
        const polymerMat = new PBRMaterial("pistol_polymer_pbr", scene);
        polymerMat.metallic = 0.1;
        polymerMat.roughness = 0.6;
        polymerMat.albedoColor = new Color3(0.08, 0.08, 0.09);

        // Polished Steel Slide
        const steelSlideMat = new PBRMaterial("pistol_slide_pbr", scene);
        steelSlideMat.metallic = 0.9;
        steelSlideMat.roughness = 0.25;
        steelSlideMat.albedoColor = new Color3(0.15, 0.16, 0.17);
        steelSlideMat.reflectivityColor = new Color3(0.8, 0.8, 0.85);

        // Silver Metallic Barrel
        const barrelMat = new PBRMaterial("pistol_barrel_pbr", scene);
        barrelMat.metallic = 0.95;
        barrelMat.roughness = 0.15;
        barrelMat.albedoColor = new Color3(0.4, 0.42, 0.45);

        // --- GEOMETRY CONSTRUCTION ---

        // 1. Pistol Grip (Polymer Handle)
        const grip = MeshBuilder.CreateBox("pistolGrip", { width: 0.16, height: 0.55, depth: 0.26 }, scene);
        grip.position.set(0, -0.25, -0.1);
        grip.rotation.x = -Math.PI / 12;
        grip.material = polymerMat;
        grip.parent = root;

        // 2. Lower Receiver / Frame
        const frame = MeshBuilder.CreateBox("pistolFrame", { width: 0.18, height: 0.2, depth: 1.1 }, scene);
        frame.position.set(0, 0.02, 0.15);
        frame.material = polymerMat;
        frame.parent = root;

        // 3. Metallic Slide (Upper Assembly)
        const slide = MeshBuilder.CreateBox("pistolSlide", { width: 0.18, height: 0.22, depth: 1.15 }, scene);
        slide.position.set(0, 0.2, 0.15);
        slide.material = steelSlideMat;
        slide.parent = root;

        // 4. Barrel Inside Slide
        const barrel = MeshBuilder.CreateCylinder("pistolBarrel", { height: 1.2, diameter: 0.09, tessellation: 20 }, scene);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.2, 0.2);
        barrel.material = barrelMat;
        barrel.parent = root;

        // 5. Trigger Guard & Trigger
        const triggerGuard = MeshBuilder.CreateTorus("pistolTriggerGuard", { diameter: 0.25, thickness: 0.03, tessellation: 20 }, scene);
        triggerGuard.rotation.y = Math.PI / 2;
        triggerGuard.position.set(0, -0.1, 0.05);
        triggerGuard.scaling.set(0.4, 0.8, 1);
        triggerGuard.material = polymerMat;
        triggerGuard.parent = root;

        const trigger = MeshBuilder.CreateBox("pistolTrigger", { width: 0.02, height: 0.12, depth: 0.03 }, scene);
        trigger.rotation.x = -Math.PI / 8;
        trigger.position.set(0, -0.08, 0.05);
        trigger.material = steelSlideMat;
        trigger.parent = root;

        // 6. Magazine Floor Plate
        const magPlate = MeshBuilder.CreateBox("pistolMagPlate", { width: 0.18, height: 0.05, depth: 0.3 }, scene);
        magPlate.position.set(0, -0.53, -0.15);
        magPlate.rotation.x = -Math.PI / 12;
        magPlate.material = polymerMat;
        magPlate.parent = root;

        // 7. Front & Rear Sights
        const rearSight = MeshBuilder.CreateBox("pistolRearSight", { width: 0.1, height: 0.08, depth: 0.1 }, scene);
        rearSight.position.set(0, 0.34, -0.35);
        rearSight.material = steelSlideMat;
        rearSight.parent = root;

        const frontSight = MeshBuilder.CreateBox("pistolFrontSight", { width: 0.04, height: 0.08, depth: 0.08 }, scene);
        frontSight.position.set(0, 0.34, 0.65);
        frontSight.material = steelSlideMat;
        frontSight.parent = root;

        // --- SCALE FOR VIEW MODEL ---
        root.scaling.scaleInPlace(0.08);

        return root;
    }
}
