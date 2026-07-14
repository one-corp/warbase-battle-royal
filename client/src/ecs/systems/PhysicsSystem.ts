import { defineQuery } from "bitecs";
import { Position, Rotation, Velocity, PhysicsBodyTag } from "../Components";
import { entityPhysicsBodies } from "../ViewMaps";

const physicsQuery = defineQuery([Position, Rotation, Velocity, PhysicsBodyTag]);

export function PhysicsSystem(world: any) {
    const entities = physicsQuery(world);

    for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];
        const body = entityPhysicsBodies.get(eid);
        
        if (body && body.transformNode) {
            // Read Havok transform back into ECS
            Position.x[eid] = body.transformNode.position.x;
            Position.y[eid] = body.transformNode.position.y;
            Position.z[eid] = body.transformNode.position.z;

            if (body.transformNode.rotationQuaternion) {
                Rotation.x[eid] = body.transformNode.rotationQuaternion.x;
                Rotation.y[eid] = body.transformNode.rotationQuaternion.y;
                Rotation.z[eid] = body.transformNode.rotationQuaternion.z;
                Rotation.w[eid] = body.transformNode.rotationQuaternion.w;
            }

            // Optional: Also read velocity from Havok to ECS if needed by logic
            const vel = body.getLinearVelocity();
            Velocity.x[eid] = vel.x;
            Velocity.y[eid] = vel.y;
            Velocity.z[eid] = vel.z;
        }
    }
}
