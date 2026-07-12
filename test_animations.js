const BABYLON = require('@babylonjs/core');
require('@babylonjs/loaders/glTF');

async function testAnimations() {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    
    console.log("Loading GLB...");
    const container = await BABYLON.SceneLoader.LoadAssetContainerAsync("file:///Users/vaidik/Developer/WarBase /fps-game/public/models/", "AnimatedSoldier.glb", scene);
    
    console.log("--- LOADED ANIMATIONS ---");
    const animGroups = container.animationGroups;
    animGroups.forEach(ag => console.log(`- "${ag.name}"`));
    
    console.log("\n--- LOOKUP TEST ---");
    const testNames = ["idle", "run", "jump", "firing", "firing walk"];
    
    testNames.forEach(name => {
        const targetAnim = animGroups.find((ag) => {
            const agName = ag.name.toLowerCase();
            if (name === "firing") {
                return agName.includes("firing") && !agName.includes("walk");
            }
            return agName.includes(name);
        });
        
        if (targetAnim) {
            console.log(`[${name}] -> Found: "${targetAnim.name}"`);
        } else {
            console.log(`[${name}] -> NOT FOUND!`);
        }
    });
    
    process.exit(0);
}
testAnimations();
