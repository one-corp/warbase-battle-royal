import { addEntity, addComponent } from "bitecs";
import { world } from "../World";
import { Position, Rotation, Velocity, InputComponent, PlayerComponent, PlayerTag, PhysicsBodyTag, Renderable } from "../Components";
import { entityMeshes, entityPhysicsBodies, entityCameras } from "../ViewMaps";
import { Scene, MeshBuilder, PhysicsAggregate, PhysicsShapeType, Vector3, UniversalCamera, PointerEventTypes, KeyboardEventTypes } from "@babylonjs/core";

export function initPlayer(scene: Scene, canvas: HTMLCanvasElement): number {
    const eid = addEntity(world);
    
    // Add all components
    addComponent(world, Position, eid);
    addComponent(world, Rotation, eid);
    addComponent(world, Velocity, eid);
    addComponent(world, InputComponent, eid);
    addComponent(world, PlayerComponent, eid);
    addComponent(world, PlayerTag, eid);
    addComponent(world, PhysicsBodyTag, eid);
    addComponent(world, Renderable, eid);

    // Initial State
    PlayerComponent.jumpCooldownTimer[eid] = 0;
    PlayerComponent.coyoteTimer[eid] = 0;
    PlayerComponent.yaw[eid] = 0;
    PlayerComponent.pitch[eid] = 0;
    PlayerComponent.isGrounded[eid] = 0;
    PlayerComponent.isCrouching[eid] = 0;
    PlayerComponent.isSprinting[eid] = 0;

    // Create Babylon Mesh & Physics
    const mesh = MeshBuilder.CreateCapsule(`player_${eid}`, { height: 1.8, radius: 0.4 }, scene);
    mesh.isVisible = false;
    
    // Initial Spawn
    // For custom maps, center spawn is safest so we don't drop off the edge into the void.
    const basePos = (window as any).SPAWN_POINT || new Vector3(0, 20, 0);
    const spawnX = basePos.x + (Math.random() * 4) - 2;
    const spawnZ = basePos.z + (Math.random() * 4) - 2;
    mesh.position.set(spawnX, basePos.y, spawnZ);

    const aggregate = new PhysicsAggregate(
        mesh, PhysicsShapeType.CAPSULE, 
        { mass: 80, friction: 0.0, restitution: 0 }, 
        scene
    );
    aggregate.body.setMassProperties({ inertia: Vector3.ZeroReadOnly });

    // Create Camera
    const camera = new UniversalCamera(`playerCamera_${eid}`, new Vector3(0, 0.6, 0), scene);
    camera.parent = mesh;
    camera.fov = 75 * (Math.PI / 180);
    camera.minZ = 0.1;

    // Map to ViewMaps
    entityMeshes.set(eid, mesh);
    entityPhysicsBodies.set(eid, aggregate.body);
    entityCameras.set(eid, camera);

    // Sync initial positions to ECS
    Position.x[eid] = mesh.position.x;
    Position.y[eid] = mesh.position.y;
    Position.z[eid] = mesh.position.z;

    setupInputListeners(eid, canvas, scene);

    return eid;
}

const KEY_MAP: Record<string, keyof typeof InputComponent> = {
    'KeyW': 'forward', 'KeyS': 'backward', 'KeyA': 'left', 'KeyD': 'right',
    'ShiftLeft': 'sprint', 'Space': 'jump', 'KeyC': 'crouch', 'KeyR': 'reload',
    'Digit1': 'weapon1', 'Digit2': 'weapon2', 'KeyG': 'grenade'
};

function setupInputListeners(eid: number, canvas: HTMLCanvasElement, scene: Scene) {
    scene.onKeyboardObservable.add((kbInfo) => {
        const key = KEY_MAP[kbInfo.event.code];
        if (key && typeof key === "string") {
            if (kbInfo.type === KeyboardEventTypes.KEYDOWN) {
                if (kbInfo.event.code === 'Space') {
                    if (!kbInfo.event.repeat) InputComponent.jump[eid] = 1;
                } else {
                    (InputComponent as any)[key][eid] = 1;
                }
            } else if (kbInfo.type === KeyboardEventTypes.KEYUP) {
                (InputComponent as any)[key][eid] = 0;
            }
        }
    });

    scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
            if (pointerInfo.event.button === 0) InputComponent.fire[eid] = 1;
            if (document.pointerLockElement === canvas) {
                if (pointerInfo.event.button === 2) InputComponent.ads[eid] = 1;
            }
        } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
            if (pointerInfo.event.button === 0) InputComponent.fire[eid] = 0;
            if (pointerInfo.event.button === 2) InputComponent.ads[eid] = 0;
        } else if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
            if (document.pointerLockElement === canvas) {
                InputComponent.mouseDeltaX[eid] += (pointerInfo.event as PointerEvent).movementX || 0;
                InputComponent.mouseDeltaY[eid] += (pointerInfo.event as PointerEvent).movementY || 0;
            }
        }
    });
}
