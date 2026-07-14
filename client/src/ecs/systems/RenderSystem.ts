import { defineQuery } from "bitecs";
import { Position, Rotation, Renderable } from "../Components";
import { entityMeshes } from "../ViewMaps";

const renderQuery = defineQuery([Position, Rotation, Renderable]);

export function RenderSystem(world: any) {
    const entities = renderQuery(world);

    for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];
        const mesh = entityMeshes.get(eid);
        if (mesh) {
            // Update Mesh position from ECS Data
            mesh.position.set(
                Position.x[eid],
                Position.y[eid],
                Position.z[eid]
            );

            // Update Mesh rotation from ECS Data
            if (mesh.rotationQuaternion) {
                mesh.rotationQuaternion.set(
                    Rotation.x[eid],
                    Rotation.y[eid],
                    Rotation.z[eid],
                    Rotation.w[eid]
                );
            }
        }
    }
}
