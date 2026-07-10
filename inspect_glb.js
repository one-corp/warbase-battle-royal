const fs = require('fs');
const path = require('path');

const glbPath = process.argv[2];
if (!glbPath) {
    console.error("Please provide a path to a GLB file.");
    process.exit(1);
}

const buffer = fs.readFileSync(glbPath);

// Check magic 'glTF'
const magic = buffer.readUInt32LE(0);
if (magic !== 0x46546C67) {
    console.error("Not a valid GLB file.");
    process.exit(1);
}

// Read JSON chunk
const jsonChunkLength = buffer.readUInt32LE(12);
const jsonChunkType = buffer.readUInt32LE(16);
if (jsonChunkType !== 0x4E4F534A) {
    console.error("First chunk is not JSON.");
    process.exit(1);
}

const jsonBuffer = buffer.slice(20, 20 + jsonChunkLength);
const gltf = JSON.parse(jsonBuffer.toString('utf8'));

console.log("=== ANIMATIONS ===");
if (gltf.animations) {
    gltf.animations.forEach((anim, i) => {
        console.log(`[${i}] ${anim.name}`);
    });
} else {
    console.log("No animations found.");
}

console.log("\n=== NODES ===");
let rightHandNode = null;
if (gltf.nodes) {
    gltf.nodes.forEach((node, i) => {
        if (node.name && node.name.toLowerCase().includes('hand')) {
            console.log(`[${i}] ${node.name}`);
            if (node.name.includes("RightHand")) {
                rightHandNode = node;
            }
        }
    });
}
