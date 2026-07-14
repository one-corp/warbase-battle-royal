import { addEntity, addComponent, defineComponent, Types, defineQuery } from "bitecs";
import { world } from "../World";
import { Position, Renderable } from "../Components";
import { entityMeshes } from "../ViewMaps";
import { MeshBuilder, Scene, Color3, Vector3 } from "@babylonjs/core";

// Custom component for tracers to track lifecycle
export const Tracer = defineComponent({
    activeTime: Types.f32
});

const MAX_TRACERS = 20;
const tracerEntities: number[] = [];
let currentTracerIndex = 0;

export function initTracerSystem(scene: Scene) {
    for (let i = 0; i < MAX_TRACERS; i++) {
        const eid = addEntity(world);
        addComponent(world, Position, eid);
        addComponent(world, Renderable, eid);
        addComponent(world, Tracer, eid);

        // We use a cylinder to simulate a thick tracer line
        const mesh = MeshBuilder.CreateCylinder(`tracer_${eid}`, { height: 1, diameter: 0.05 }, scene);
        mesh.rotation.x = Math.PI / 2;
        mesh.isPickable = false;
        mesh.isVisible = false; // Hide initially

        // Give it a bright emissive material (we'll reuse the scene's default material or create one)
        
        entityMeshes.set(eid, mesh);
        tracerEntities.push(eid);
    }
}

export function spawnTracer(start: Vector3, end: Vector3) {
    const eid = tracerEntities[currentTracerIndex];
    
    // Position at the midpoint
    const midPoint = start.add(end).scale(0.5);
    Position.x[eid] = midPoint.x;
    Position.y[eid] = midPoint.y;
    Position.z[eid] = midPoint.z;

    const mesh = entityMeshes.get(eid);
    if (mesh) {
        // Calculate length
        const distance = Vector3.Distance(start, end);
        mesh.scaling.y = distance; // Scale the cylinder height

        // Point the cylinder from start to end
        mesh.position.copyFrom(midPoint);
        mesh.lookAt(end);
        mesh.isVisible = true;
    }

    Tracer.activeTime[eid] = 0.05; // Visible for 50ms

    currentTracerIndex = (currentTracerIndex + 1) % MAX_TRACERS;
}

const tracerQuery = defineQuery([Tracer, Renderable]);

export function updateTracers(dt: number) {
    const entities = tracerQuery(world);
    for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];
        if (Tracer.activeTime[eid] > 0) {
            Tracer.activeTime[eid] -= dt;
            if (Tracer.activeTime[eid] <= 0) {
                const mesh = entityMeshes.get(eid);
                if (mesh) mesh.isVisible = false;
            }
        }
    }
}
