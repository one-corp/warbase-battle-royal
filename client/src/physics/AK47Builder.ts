import { 
    Scene, 
    TransformNode, 
    MeshBuilder, 
    PBRMaterial, 
    Color3
} from "@babylonjs/core";

export class AK47Builder {
    public static Build(scene: Scene): TransformNode {
        const root = new TransformNode("ak47", scene);

        // --- HIGH QUALITY PBR MATERIALS ---
        // 1. Stamped Gunmetal / Receiver Metal
        const metalMat = new PBRMaterial("ak_metal_pbr", scene);
        metalMat.metallic = 0.85;
        metalMat.roughness = 0.35;
        metalMat.albedoColor = new Color3(0.12, 0.13, 0.14);
        metalMat.reflectivityColor = new Color3(0.7, 0.7, 0.75);

        // 2. Dark Steel (Barrel, Sights, Gas Block)
        const darkSteelMat = new PBRMaterial("ak_dark_steel_pbr", scene);
        darkSteelMat.metallic = 0.95;
        darkSteelMat.roughness = 0.25;
        darkSteelMat.albedoColor = new Color3(0.06, 0.07, 0.08);

        // 3. Ribbed Steel (Magazine)
        const magMat = new PBRMaterial("ak_mag_pbr", scene);
        magMat.metallic = 0.8;
        magMat.roughness = 0.45;
        magMat.albedoColor = new Color3(0.08, 0.08, 0.09);

        // 4. Polished Wooden Furniture (Varnished Birch / Mahogany)
        const woodMat = new PBRMaterial("ak_wood_pbr", scene);
        woodMat.metallic = 0.05;
        woodMat.roughness = 0.25; // Glossy varnish finish
        woodMat.albedoColor = new Color3(0.42, 0.18, 0.08);
        woodMat.reflectivityColor = new Color3(0.2, 0.15, 0.1);

        // --- GEOMETRY CONSTRUCTION ---

        // 1. Receiver (Main Stamped Metal Chassis)
        const receiver = MeshBuilder.CreateBox("receiver", { width: 0.28, height: 0.45, depth: 1.8 }, scene);
        receiver.material = metalMat;
        receiver.parent = root;

        // 2. Receiver Top Plate / Dust Cover (Ribbed & Curved)
        const dustCover = MeshBuilder.CreateCylinder("dustCover", { height: 1.82, diameter: 0.29, tessellation: 24 }, scene);
        dustCover.rotation.x = Math.PI / 2;
        dustCover.position.y = 0.22;
        dustCover.material = metalMat;
        dustCover.parent = root;

        // 3. Charging Handle & Bolt Carrier (Right side detail)
        const boltCarrier = MeshBuilder.CreateCylinder("boltCarrier", { height: 0.8, diameter: 0.12, tessellation: 16 }, scene);
        boltCarrier.rotation.x = Math.PI / 2;
        boltCarrier.position.set(0.12, 0.18, 0.2);
        boltCarrier.material = darkSteelMat;
        boltCarrier.parent = root;

        const chargingHandle = MeshBuilder.CreateCylinder("chargingHandle", { height: 0.3, diameter: 0.08, tessellation: 16 }, scene);
        chargingHandle.rotation.z = Math.PI / 2;
        chargingHandle.position.set(0.25, 0.18, 0.2);
        chargingHandle.material = darkSteelMat;
        chargingHandle.parent = root;

        // 4. Fire Selector Switch (Right side lever)
        const selectorLever = MeshBuilder.CreateBox("selectorLever", { width: 0.04, height: 0.12, depth: 0.6 }, scene);
        selectorLever.rotation.x = Math.PI / 18;
        selectorLever.position.set(0.15, 0.05, -0.1);
        selectorLever.material = metalMat;
        selectorLever.parent = root;

        // 5. Wooden Rear Stock (Classic AK Angled Comb with Buttplate)
        const stock = MeshBuilder.CreateBox("stock", { width: 0.24, height: 0.42, depth: 1.3 }, scene);
        stock.position.set(0, -0.12, -1.55);
        stock.rotation.x = Math.PI / 30;
        stock.material = woodMat;
        stock.parent = root;

        const buttPlate = MeshBuilder.CreateBox("buttPlate", { width: 0.25, height: 0.44, depth: 0.06 }, scene);
        buttPlate.position.set(0, -0.15, -2.2);
        buttPlate.material = darkSteelMat;
        buttPlate.parent = root;

        // 6. Curved 7.62x39mm Steel Magazine with Ribs
        const magBase = MeshBuilder.CreateBox("magBase", { width: 0.22, height: 1.1, depth: 0.38 }, scene);
        magBase.position.set(0, -0.65, 0.55);
        magBase.rotation.x = -Math.PI / 7;
        magBase.material = magMat;
        magBase.parent = root;

        // Add magazine ridges/ribs for high detail
        for (let i = 0; i < 4; i++) {
            const rib = MeshBuilder.CreateBox(`magRib_${i}`, { width: 0.24, height: 0.05, depth: 0.4 }, scene);
            rib.position.set(0, -0.45 - (i * 0.18), 0.48 + (i * 0.07));
            rib.rotation.x = -Math.PI / 7;
            rib.material = darkSteelMat;
            rib.parent = root;
        }

        // 7. Trigger Guard & Trigger
        const triggerGuard = MeshBuilder.CreateTorus("triggerGuard", { diameter: 0.3, thickness: 0.04, tessellation: 24 }, scene);
        triggerGuard.rotation.y = Math.PI / 2;
        triggerGuard.position.set(0, -0.32, -0.25);
        triggerGuard.scaling.set(0.5, 1, 1);
        triggerGuard.material = darkSteelMat;
        triggerGuard.parent = root;

        const trigger = MeshBuilder.CreateBox("trigger", { width: 0.03, height: 0.15, depth: 0.04 }, scene);
        trigger.rotation.x = -Math.PI / 6;
        trigger.position.set(0, -0.3, -0.25);
        trigger.material = darkSteelMat;
        trigger.parent = root;

        // 8. Wooden Pistol Grip
        const grip = MeshBuilder.CreateBox("grip", { width: 0.22, height: 0.55, depth: 0.28 }, scene);
        grip.position.set(0, -0.45, -0.65);
        grip.rotation.x = -Math.PI / 10;
        grip.material = woodMat;
        grip.parent = root;

        // 9. Barrel & Muzzle Slant Brake
        const barrel = MeshBuilder.CreateCylinder("barrel", { height: 2.4, diameter: 0.11, tessellation: 20 }, scene);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.1, 2.1);
        barrel.material = darkSteelMat;
        barrel.parent = root;

        const slantBrake = MeshBuilder.CreateCylinder("slantBrake", { height: 0.25, diameter: 0.13, tessellation: 16 }, scene);
        slantBrake.rotation.x = Math.PI / 2 + Math.PI / 12; // Slanted muzzle break cutout
        slantBrake.position.set(0, 0.11, 3.35);
        slantBrake.material = darkSteelMat;
        slantBrake.parent = root;

        // 10. Gas Tube & Gas Block (Upper Assembly)
        const gasTube = MeshBuilder.CreateCylinder("gasTube", { height: 1.1, diameter: 0.14, tessellation: 20 }, scene);
        gasTube.rotation.x = Math.PI / 2;
        gasTube.position.set(0, 0.24, 1.5);
        gasTube.material = darkSteelMat;
        gasTube.parent = root;

        const gasBlock = MeshBuilder.CreateBox("gasBlock", { width: 0.18, height: 0.32, depth: 0.25 }, scene);
        gasBlock.position.set(0, 0.2, 2.05);
        gasBlock.material = darkSteelMat;
        gasBlock.parent = root;

        // 11. Wooden Handguards (Lower & Upper)
        const lowerHandguard = MeshBuilder.CreateBox("lowerHandguard", { width: 0.32, height: 0.28, depth: 1.05 }, scene);
        lowerHandguard.position.set(0, 0.04, 1.45);
        lowerHandguard.material = woodMat;
        lowerHandguard.parent = root;

        const upperHandguard = MeshBuilder.CreateCylinder("upperHandguard", { height: 0.95, diameter: 0.32, tessellation: 20 }, scene);
        upperHandguard.rotation.x = Math.PI / 2;
        upperHandguard.position.set(0, 0.24, 1.45);
        upperHandguard.material = woodMat;
        upperHandguard.parent = root;

        // 12. Front & Rear Iron Sights
        const rearSightBase = MeshBuilder.CreateBox("rearSightBase", { width: 0.18, height: 0.18, depth: 0.3 }, scene);
        rearSightBase.position.set(0, 0.38, 0.85);
        rearSightBase.material = darkSteelMat;
        rearSightBase.parent = root;

        const frontSightPost = MeshBuilder.CreateBox("frontSightPost", { width: 0.04, height: 0.22, depth: 0.08 }, scene);
        frontSightPost.position.set(0, 0.32, 3.1);
        frontSightPost.material = darkSteelMat;
        frontSightPost.parent = root;

        const frontSightRing = MeshBuilder.CreateTorus("frontSightRing", { diameter: 0.22, thickness: 0.03, tessellation: 20 }, scene);
        frontSightRing.position.set(0, 0.32, 3.1);
        frontSightRing.material = darkSteelMat;
        frontSightRing.parent = root;

        // 13. Red Dot Sight (Modern Optic)
        // Red Dot Sight Base / Mount
        const opticMount = MeshBuilder.CreateBox("opticMount", { width: 0.2, height: 0.15, depth: 0.6 }, scene);
        opticMount.position.set(0, 0.42, 0.2);
        opticMount.material = darkSteelMat;
        opticMount.parent = root;

        // Red Dot Sight Housing
        const opticHousing = MeshBuilder.CreateBox("opticHousing", { width: 0.24, height: 0.25, depth: 0.4 }, scene);
        opticHousing.position.set(0, 0.58, 0.2);
        opticHousing.material = darkSteelMat;
        opticHousing.parent = root;

        // Holographic Glass Lens
        const opticLens = MeshBuilder.CreatePlane("opticLens", { width: 0.18, height: 0.18 }, scene);
        opticLens.position.set(0, 0.58, 0.39);
        const glassMat = new PBRMaterial("glassMat", scene);
        glassMat.alpha = 0.3;
        glassMat.albedoColor = new Color3(0.1, 0.3, 0.5);
        glassMat.metallic = 0.1;
        glassMat.roughness = 0.1;
        opticLens.material = glassMat;
        opticLens.parent = root;

        // Emissive Red Dot Reticle
        const reticle = MeshBuilder.CreatePlane("reticle", { size: 0.015 }, scene);
        reticle.position.set(0, 0.58, 0.38); // Slightly behind the lens so it doesn't clip
        const reticleMat = new PBRMaterial("reticleMat", scene);
        reticleMat.albedoColor = new Color3(1, 0, 0);
        reticleMat.emissiveColor = new Color3(1, 0, 0);
        reticleMat.disableLighting = true; // Always bright red
        reticle.material = reticleMat;
        reticle.parent = root;

        // --- SCALE FOR FIRST PERSON VIEW ---
        root.scaling.scaleInPlace(0.08);

        return root;
    }
}
