import { defineQuery } from "bitecs";
import { Position, Rotation, PhysicsBodyTag } from "../Components";
import { entityMeshes } from "../ViewMaps";

const physicsQuery = defineQuery([Position, Rotation, PhysicsBodyTag]);

export function PhysicsSystem(world: any) {
    const entities = physicsQuery(world);

    for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];
        const mesh = entityMeshes.get(eid);
        if (mesh) {
            // The Babylon PhysicsAggregate automatically syncs the Havok body to the Babylon mesh.
            // So we just read the updated Mesh transform back into ECS.
            Position.x[eid] = mesh.position.x;
            Position.y[eid] = mesh.position.y;
            Position.z[eid] = mesh.position.z;

            if (mesh.rotationQuaternion) {
                Rotation.x[eid] = mesh.rotationQuaternion.x;
                Rotation.y[eid] = mesh.rotationQuaternion.y;
                Rotation.z[eid] = mesh.rotationQuaternion.z;
                Rotation.w[eid] = mesh.rotationQuaternion.w;
            }

        }
    }
}
