import { 
    Scene, Vector3, TransformNode, MeshBuilder, 
    PBRMaterial, Color3 
} from "@babylonjs/core";

export class M2010Builder {
    public static Build(scene: Scene): TransformNode {
        const root = new TransformNode("m2010_root", scene);

        // --- MATERIALS ---
        // 1. Dark Tactical Olive/Tan Metal Body
        const chassisMat = new PBRMaterial("m2010_chassis_mat", scene);
        chassisMat.albedoColor = new Color3(0.18, 0.17, 0.15); // Dark Tactical Tan / Olive Steel
        chassisMat.metallic = 0.85;
        chassisMat.roughness = 0.3;

        // 2. High-Tech Matte Black Steel (Barrel, Action, Scope Body)
        const matteSteel = new PBRMaterial("m2010_steel_mat", scene);
        matteSteel.albedoColor = new Color3(0.08, 0.08, 0.09);
        matteSteel.metallic = 0.95;
        matteSteel.roughness = 0.25;

        // 3. Glass Optic Lens Tint (Scope Glass)
        const lensMat = new PBRMaterial("m2010_lens_mat", scene);
        lensMat.albedoColor = new Color3(0.1, 0.4, 0.6);
        lensMat.metallic = 0.9;
        lensMat.roughness = 0.05;
        lensMat.alpha = 0.85;

        // 4. Polymer Rubber Grip & Buttpad
        const polymerMat = new PBRMaterial("m2010_polymer_mat", scene);
        polymerMat.albedoColor = new Color3(0.05, 0.05, 0.05);
        polymerMat.metallic = 0.1;
        polymerMat.roughness = 0.7;

        // --- 1. RECEIVER & ACTION CHASSIS ---
        const receiver = MeshBuilder.CreateBox("receiver", { width: 0.07, height: 0.09, depth: 0.4 }, scene);
        receiver.position = new Vector3(0, 0.04, 0.15);
        receiver.material = chassisMat;
        receiver.parent = root;

        // Ejection Port Cutout
        const ejectionPort = MeshBuilder.CreateBox("ejection_port", { width: 0.05, height: 0.04, depth: 0.12 }, scene);
        ejectionPort.position = new Vector3(0.02, 0.06, 0.18);
        const portMat = new PBRMaterial("portMat", scene);
        portMat.albedoColor = new Color3(0.02, 0.02, 0.02);
        portMat.roughness = 0.8;
        portMat.metallic = 0.1;
        ejectionPort.material = portMat;
        ejectionPort.parent = root;

        // Bolt Handle & Knob
        const boltStem = MeshBuilder.CreateCylinder("bolt_stem", { diameter: 0.015, height: 0.08 }, scene);
        boltStem.rotation.z = Math.PI / 3;
        boltStem.position = new Vector3(0.05, 0.04, 0.08);
        boltStem.material = matteSteel;
        boltStem.parent = root;

        const boltKnob = MeshBuilder.CreateSphere("bolt_knob", { diameter: 0.035 }, scene);
        boltKnob.position = new Vector3(0.08, 0.01, 0.08);
        boltKnob.material = matteSteel;
        boltKnob.parent = root;

        // --- 2. TACTICAL CHASSIS STOCK ---
        const stockMain = MeshBuilder.CreateBox("stock_main", { width: 0.05, height: 0.08, depth: 0.3 }, scene);
        stockMain.position = new Vector3(0, 0.02, -0.2);
        stockMain.material = chassisMat;
        stockMain.parent = root;

        // Adjustable Cheek Riser
        const cheekRiser = MeshBuilder.CreateBox("cheek_riser", { width: 0.048, height: 0.04, depth: 0.15 }, scene);
        cheekRiser.position = new Vector3(0, 0.08, -0.22);
        cheekRiser.material = polymerMat;
        cheekRiser.parent = root;

        // Rubber Buttpad
        const buttpad = MeshBuilder.CreateBox("buttpad", { width: 0.055, height: 0.12, depth: 0.04 }, scene);
        buttpad.position = new Vector3(0, 0.01, -0.37);
        buttpad.material = polymerMat;
        buttpad.parent = root;

        // Pistol Grip
        const grip = MeshBuilder.CreateBox("grip", { width: 0.04, height: 0.13, depth: 0.05 }, scene);
        grip.position = new Vector3(0, -0.06, -0.02);
        grip.rotation.x = Math.PI / 8;
        grip.material = polymerMat;
        grip.parent = root;

        // --- 3. LONG FLUTED HEAVY BARREL ---
        const barrel = MeshBuilder.CreateCylinder("barrel", { diameter: 0.032, height: 0.85 }, scene);
        barrel.rotation.x = Math.PI / 2;
        barrel.position = new Vector3(0, 0.045, 0.77);
        barrel.material = matteSteel;
        barrel.parent = root;

        // Fluting detail lines along barrel
        for (let i = 0; i < 4; i++) {
            const flute = MeshBuilder.CreateBox(`flute_${i}`, { width: 0.005, height: 0.005, depth: 0.5 }, scene);
            const angle = (i * Math.PI) / 2;
            flute.position = new Vector3(Math.cos(angle) * 0.016, 0.045 + Math.sin(angle) * 0.016, 0.75);
            flute.material = chassisMat;
            flute.parent = root;
        }

        // Tactical Muzzle Brake
        const muzzleBrake = MeshBuilder.CreateBox("muzzle_brake", { width: 0.042, height: 0.042, depth: 0.1 }, scene);
        muzzleBrake.position = new Vector3(0, 0.045, 1.23);
        muzzleBrake.material = matteSteel;
        muzzleBrake.parent = root;

        // Muzzle brake ports
        const portL = MeshBuilder.CreateBox("mb_port_l", { width: 0.045, height: 0.02, depth: 0.02 }, scene);
        portL.position = new Vector3(0, 0.045, 1.21);
        portL.material = polymerMat;
        portL.parent = root;

        const portR = MeshBuilder.CreateBox("mb_port_r", { width: 0.045, height: 0.02, depth: 0.02 }, scene);
        portR.position = new Vector3(0, 0.045, 1.25);
        portR.material = polymerMat;
        portR.parent = root;

        // --- 4. HIGH-POWERED SNIPER OPTIC SCOPE ---
        // Picatinny Rail Mount
        const rail = MeshBuilder.CreateBox("picatinny_rail", { width: 0.035, height: 0.015, depth: 0.35 }, scene);
        rail.position = new Vector3(0, 0.095, 0.15);
        rail.material = matteSteel;
        rail.parent = root;

        // Scope Rings (Front & Rear)
        const ringRear = MeshBuilder.CreateCylinder("ring_rear", { diameter: 0.048, height: 0.025 }, scene);
        ringRear.position = new Vector3(0, 0.12, 0.05);
        ringRear.material = matteSteel;
        ringRear.parent = root;

        const ringFront = MeshBuilder.CreateCylinder("ring_front", { diameter: 0.048, height: 0.025 }, scene);
        ringFront.position = new Vector3(0, 0.12, 0.25);
        ringFront.material = matteSteel;
        ringFront.parent = root;

        // Main Scope Tube
        const scopeTube = MeshBuilder.CreateCylinder("scope_tube", { diameter: 0.04, height: 0.36 }, scene);
        scopeTube.rotation.x = Math.PI / 2;
        scopeTube.position = new Vector3(0, 0.135, 0.15);
        scopeTube.material = matteSteel;
        scopeTube.parent = root;

        // Large Objective Lens Cone (Front)
        const objectiveCone = MeshBuilder.CreateCylinder("scope_objective", { diameterTop: 0.04, diameterBottom: 0.06, height: 0.08 }, scene);
        objectiveCone.rotation.x = Math.PI / 2;
        objectiveCone.position = new Vector3(0, 0.135, 0.37);
        objectiveCone.material = matteSteel;
        objectiveCone.parent = root;

        // Front Glass Lens
        const frontLens = MeshBuilder.CreateCylinder("front_lens", { diameter: 0.056, height: 0.005 }, scene);
        frontLens.rotation.x = Math.PI / 2;
        frontLens.position = new Vector3(0, 0.135, 0.41);
        frontLens.material = lensMat;
        frontLens.parent = root;

        // Ocular Bell (Rear Eye Piece)
        const ocularBell = MeshBuilder.CreateCylinder("scope_ocular", { diameterTop: 0.045, diameterBottom: 0.04, height: 0.06 }, scene);
        ocularBell.rotation.x = Math.PI / 2;
        ocularBell.position = new Vector3(0, 0.135, -0.06);
        ocularBell.material = matteSteel;
        ocularBell.parent = root;

        // Rear Glass Lens
        const rearLens = MeshBuilder.CreateCylinder("rear_lens", { diameter: 0.042, height: 0.005 }, scene);
        rearLens.rotation.x = Math.PI / 2;
        rearLens.position = new Vector3(0, 0.135, -0.09);
        rearLens.material = lensMat;
        rearLens.parent = root;

        // Turret Knobs (Elevation & Windage)
        const turretTop = MeshBuilder.CreateCylinder("turret_top", { diameter: 0.025, height: 0.025 }, scene);
        turretTop.position = new Vector3(0, 0.165, 0.15);
        turretTop.material = matteSteel;
        turretTop.parent = root;

        const turretSide = MeshBuilder.CreateCylinder("turret_side", { diameter: 0.025, height: 0.025 }, scene);
        turretSide.rotation.z = Math.PI / 2;
        turretSide.position = new Vector3(0.03, 0.135, 0.15);
        turretSide.material = matteSteel;
        turretSide.parent = root;

        // --- 5. DETACHABLE BOX MAGAZINE ---
        const mag = MeshBuilder.CreateBox("magazine", { width: 0.035, height: 0.14, depth: 0.09 }, scene);
        mag.position = new Vector3(0, -0.05, 0.16);
        mag.material = matteSteel;
        mag.parent = root;

        return root;
    }
}
