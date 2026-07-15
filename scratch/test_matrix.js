const BABYLON = require('@babylonjs/core');
const engine = new BABYLON.NullEngine();
const scene = new BABYLON.Scene(engine);
const box = BABYLON.MeshBuilder.CreateBox("box", {size: 1}, scene);
box.position.y = 10;
box.computeWorldMatrix(true);
const inv = box.getWorldMatrix().clone().invert();
const point = new BABYLON.Vector3(0, 11.8, 0);
BABYLON.Vector3.TransformCoordinatesToRef(point, inv, point);
console.log("Local point:", point);

const worldPoint = new BABYLON.Vector3();
BABYLON.Vector3.TransformCoordinatesToRef(point, box.getWorldMatrix(), worldPoint);
console.log("World point:", worldPoint);
