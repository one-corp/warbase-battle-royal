import { addEntity, addComponent } from "bitecs";
import { world } from "../World";
import { Position, Rotation, Renderable } from "../Components";
import { entityMeshes } from "../ViewMaps";
import { MeshBuilder, Scene, StandardMaterial, Texture, Color3, Vector3 } from "@babylonjs/core";

const MAX_DECALS = 50;
const decalEntities: number[] = [];
let currentDecalIndex = 0;

export function initDecalSystem(scene: Scene) {
    decalEntities.length = 0;
    currentDecalIndex = 0;

    const mat = new StandardMaterial("bulletHoleMat", scene);
    mat.diffuseTexture = new Texture("https://playground.babylonjs.com/textures/impact.png", scene);
    mat.diffuseTexture.hasAlpha = true;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = new Color3(0.2, 0.2, 0.2);
    mat.backFaceCulling = false;

    for (let i = 0; i < MAX_DECALS; i++) {
        const eid = addEntity(world);
        addComponent(world, Position, eid);
        addComponent(world, Rotation, eid);
        addComponent(world, Renderable, eid);

        const mesh = MeshBuilder.CreatePlane(`decal_${eid}`, { size: 0.3 }, scene);
        mesh.material = mat;
        mesh.isPickable = false;
        mesh.isVisible = false; // Hide initially

        entityMeshes.set(eid, mesh);
        decalEntities.push(eid);
    }
}

export function spawnDecal(position: Vector3, lookAtTarget: Vector3) {
    const eid = decalEntities[currentDecalIndex];
    
    Position.x[eid] = position.x;
    Position.y[eid] = position.y;
    Position.z[eid] = position.z;

    const mesh = entityMeshes.get(eid);
    if (mesh) {
        mesh.position.copyFrom(position);
        mesh.lookAt(lookAtTarget);
        mesh.isVisible = true;
    }

    currentDecalIndex = (currentDecalIndex + 1) % MAX_DECALS;
}
