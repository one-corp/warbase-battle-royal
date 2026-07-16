const { NullEngine } = require("@babylonjs/core/Engines/nullEngine");
const { Scene } = require("@babylonjs/core/scene");
const { SceneLoader } = require("@babylonjs/core/Loading/sceneLoader");
require("@babylonjs/loaders/glTF");

async function run() {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    
    console.log("Loading Game Arena...");
    let container = await SceneLoader.LoadAssetContainerAsync("file://" + __dirname + "/client/public/maps/", "fps_shooter_game_arena_map_v3.glb", scene);
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
    
    console.log("Loading Ghost City...");
    container = await SceneLoader.LoadAssetContainerAsync("file://" + __dirname + "/client/public/maps/", "BLD_Ghost_city.glb", scene);
    min = [999,999,999]; max = [-999,-999,-999];
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
    console.log("Ghost City Bounds:", {min, max});
}
run();
