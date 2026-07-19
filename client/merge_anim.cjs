global.XMLHttpRequest = require("xhr2");
const { NullEngine } = require("@babylonjs/core/Engines/nullEngine");
const { Scene } = require("@babylonjs/core/scene");
const { SceneLoader } = require("@babylonjs/core/Loading/sceneLoader");
const { GLTF2Export } = require("@babylonjs/serializers/glTF");
require("@babylonjs/loaders");

const fs = require("fs");

async function run() {
    console.log("Initializing Babylon.js NullEngine...");
    const engine = new NullEngine();
    const scene = new Scene(engine);
    
    console.log("Loading AnimatedSoldier.glb...");
    const glbData = fs.readFileSync(__dirname + "/public/models/AnimatedSoldier.glb");
    const glbUrl = "data:;base64," + glbData.toString("base64");
    
    const glbContainer = await SceneLoader.LoadAssetContainerAsync(
        glbUrl, 
        "", 
        scene,
        null,
        ".glb"
    );
    glbContainer.addAllToScene();

    console.log("Loading Walking Backwards.fbx...");
    const fbxData = fs.readFileSync(__dirname + "/../mixamo/Character/Walking Backwards.fbx");
    const fbxUrl = "data:;base64," + fbxData.toString("base64");

    const fbxContainer = await SceneLoader.LoadAssetContainerAsync(
        fbxUrl, 
        "", 
        scene,
        null,
        ".fbx"
    );

    console.log("Extracting AnimationGroups from FBX...");
    // Grab the first animation group from the FBX
    const backAnim = fbxContainer.animationGroups[0];
    if (!backAnim) {
        console.error("No animation found in FBX!");
        process.exit(1);
    }
    
    // Rename it
    backAnim.name = "Walking Backwards";
    
    // FBX meshes have different names/hierarchy sometimes. We need to retarget 
    // the animation from the FBX skeleton to the GLB skeleton.
    // However, Mixamo FBX animations usually target bones with the same names.
    // In Babylon.js, AnimationGroup targets are TransformNodes/Bones.
    console.log("Retargeting animation...");
    const glbNodes = scene.transformNodes.concat(scene.meshes);
    
    for (const targetedAnim of backAnim.targetedAnimations) {
        const targetName = targetedAnim.target.name;
        // Find matching node in GLB scene
        const matchingNode = glbNodes.find(n => n.name === targetName && n.parent !== null);
        if (matchingNode) {
            targetedAnim.target = matchingNode;
        }
    }
    
    // Add to scene so it exports
    scene.animationGroups.push(backAnim);
    
    // Clean up FBX meshes (we only want the animation)
    fbxContainer.meshes.forEach(m => m.dispose());
    fbxContainer.skeletons.forEach(s => s.dispose());

    console.log("Exporting to GLB...");
    const glb = await GLTF2Export.GLBAsync(scene, "AnimatedSoldier");
    
    const blob = glb.glTFFiles["AnimatedSoldier.glb"];
    const arrayBuffer = await blob.arrayBuffer();
    const outputPath = __dirname + "/public/models/AnimatedSoldier.glb";
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    console.log("Successfully exported to " + outputPath);
}

run().catch(console.error);
