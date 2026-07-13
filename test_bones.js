const BABYLON = require('babylonjs');
const loaders = require('babylonjs-loaders');
const engine = new BABYLON.NullEngine();
const scene = new BABYLON.Scene(engine);

BABYLON.SceneLoader.LoadAssetContainerAsync("file:///Users/vaidik/Developer/WarBase /client/public/models/", "AnimatedSoldier.glb", scene).then(container => {
    const root = container.rootNodes[0];
    const nodes = root.getChildTransformNodes(false);
    const rightArm = nodes.find(n => n.name.includes("RightArm"));
    const rightLeg = nodes.find(n => n.name.includes("RightUpLeg"));
    
    rightArm.computeWorldMatrix(true);
    rightLeg.computeWorldMatrix(true);

    const armDir = rightArm.getDirection(new BABYLON.Vector3(0, 1, 0)); // Local Y
    console.log("RightArm Local Y points in world:", armDir);
    
    const armDirX = rightArm.getDirection(new BABYLON.Vector3(1, 0, 0)); // Local X
    console.log("RightArm Local X points in world:", armDirX);
    
    const armDirZ = rightArm.getDirection(new BABYLON.Vector3(0, 0, 1)); // Local Z
    console.log("RightArm Local Z points in world:", armDirZ);

    const legDirY = rightLeg.getDirection(new BABYLON.Vector3(0, 1, 0)); // Local Y
    console.log("RightLeg Local Y points in world:", legDirY);
    
    const legDirX = rightLeg.getDirection(new BABYLON.Vector3(1, 0, 0)); // Local X
    console.log("RightLeg Local X points in world:", legDirX);

    const legDirZ = rightLeg.getDirection(new BABYLON.Vector3(0, 0, 1)); // Local Z
    console.log("RightLeg Local Z points in world:", legDirZ);
    
    process.exit(0);
});
