const { NullEngine } = require("@babylonjs/core/Engines/nullEngine.js");
const { Scene } = require("@babylonjs/core/scene.js");
const { SceneLoader } = require("@babylonjs/core/Loading/sceneLoader.js");
require("@babylonjs/loaders/glTF");

async function run() {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    
    console.log("Loading Game Arena...");
    try {
        let container = await SceneLoader.LoadAssetContainerAsync("file://" + __dirname + "/public/maps/", "fps_shooter_game_arena_map_v3.glb", scene);
        let min = [999,999,999], max = [-999,-999,-999];
        container.meshes.forEach(m => {
            m.computeWorldMatrix(true);
            let b = m.getBoundingInfo().boundingBox;
            if(b.minimumWorld.x < min[0]) min[0] = b.minimumWorld.x;
            if(b.maximumWorld.x > max[0]) max[0] = b.maximumWorld.x;
            if(b.minimumWorld.y < min[1]) min[1] = b.minimumWorld.y;
            if(b.maximumWorld.y > max[1]) max[1] = b.maximumWorld.y;
            if(b.minimumWorld.z < min[2]) min[2] = b.minimumWorld.z;
            if(b.maximumWorld.z > max[2]) max[2] = b.maximumWorld.z;
        });
        console.log("Arena Bounds:", {min, max});
    } catch(e) {
        console.error(e);
    }
}
run();
