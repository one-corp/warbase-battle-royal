import { addEntity, addComponent, defineComponent, Types, defineQuery } from "bitecs";
import { world } from "../World";
import { Position, Renderable } from "../Components";
import { entityMeshes } from "../ViewMaps";
import { MeshBuilder, Scene, Vector3, StandardMaterial, Color3 } from "@babylonjs/core";

// Custom component for tracers to track lifecycle
export const Tracer = defineComponent({
    activeTime: Types.f32
});

interface TracerData {
    start: Vector3;
    end: Vector3;
    distance: number;
    progress: number;
    speed: number;
}
const tracerDataMap = new Map<number, TracerData>();

const MAX_TRACERS = 30;
const tracerEntities: number[] = [];
let currentTracerIndex = 0;

export function initTracerSystem(scene: Scene) {
    tracerEntities.length = 0;
    currentTracerIndex = 0;
    tracerDataMap.clear();

    for (let i = 0; i < MAX_TRACERS; i++) {
        const eid = addEntity(world);
        addComponent(world, Position, eid);
        addComponent(world, Renderable, eid);
        addComponent(world, Tracer, eid);

        // We use an ultra-thin cylinder for high-velocity look
        const mesh = MeshBuilder.CreateCylinder(`tracer_${eid}`, { height: 1, diameter: 0.008 }, scene);
        mesh.rotation.x = Math.PI / 2;
        mesh.bakeCurrentTransformIntoVertices();
        mesh.isPickable = false;
        mesh.isVisible = false; // Hide initially

        // Give it a bright emissive material
        const mat = new StandardMaterial(`tracerMat_${eid}`, scene);
        mat.emissiveColor = new Color3(1.0, 0.95, 0.7); // Pale yellow/white
        mat.disableLighting = true; // Unaffected by shadows/lights
        mesh.material = mat;
        
        entityMeshes.set(eid, mesh);
        tracerEntities.push(eid);
    }
}

export function spawnTracer(start: Vector3, end: Vector3) {
    const eid = tracerEntities[currentTracerIndex];
    
    const distance = Vector3.Distance(start, end);
    tracerDataMap.set(eid, {
        start: start.clone(),
        end: end.clone(),
        distance: distance,
        progress: 0,
        speed: 300 // 300 units per second visually
    });

    const mesh = entityMeshes.get(eid);
    if (mesh) {
        // Tracer streak is a fixed length (or capped by distance if shot is very close)
        mesh.scaling.z = Math.min(3, distance); 
        
        mesh.position.copyFrom(start);
        mesh.lookAt(end);
        mesh.isVisible = true;
        mesh.visibility = 1.0; 
    }

    Tracer.activeTime[eid] = 2.0; // Max lifetime 2 seconds (safety kill)

    currentTracerIndex = (currentTracerIndex + 1) % MAX_TRACERS;
}

const tracerQuery = defineQuery([Tracer, Renderable]);

export function updateTracers(dt: number) {
    const entities = tracerQuery(world);
    for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];
        if (Tracer.activeTime[eid] > 0) {
            Tracer.activeTime[eid] -= dt;
            
            const data = tracerDataMap.get(eid);
            const mesh = entityMeshes.get(eid);
            
            if (data && mesh) {
                data.progress += (data.speed * dt);
                
                if (data.progress >= data.distance) {
                    // Reached the wall
                    Tracer.activeTime[eid] = 0;
                    mesh.isVisible = false;
                } else {
                    // Move tracer forward
                    const dir = data.end.subtract(data.start).normalize();
                    mesh.position = data.start.add(dir.scale(data.progress));
                }
            }

            if (Tracer.activeTime[eid] <= 0) {
                if (mesh) mesh.isVisible = false;
            }
        }
    }
}
