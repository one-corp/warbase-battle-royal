import { addEntity, addComponent, defineQuery } from "bitecs";
import { world } from "../World";
import { Position, Rotation, Velocity, InputComponent, PlayerComponent, PlayerTag, PhysicsBodyTag, Renderable } from "../Components";
import { entityMeshes, entityPhysicsBodies, entityCameras } from "../ViewMaps";
import { Scene, MeshBuilder, PhysicsAggregate, PhysicsShapeType, Vector3, UniversalCamera, Scalar, Ray, PhysicsMotionType } from "@babylonjs/core";

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
    const spawnX = (Math.random() * 10) - 5;
    const spawnZ = Math.random() > 0.5 ? 45 + (Math.random() * 5) : -45 - (Math.random() * 5);
    mesh.position.set(spawnX, 10, spawnZ);

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

    setupInputListeners(eid, canvas);

    return eid;
}

const KEY_MAP: Record<string, keyof typeof InputComponent> = {
    'KeyW': 'forward', 'KeyS': 'backward', 'KeyA': 'left', 'KeyD': 'right',
    'ShiftLeft': 'sprint', 'Space': 'jump', 'KeyC': 'crouch', 'KeyR': 'reload',
    'Digit1': 'weapon1', 'Digit2': 'weapon2', 'KeyG': 'grenade'
};

function setupInputListeners(eid: number, canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
        const key = KEY_MAP[e.code];
        if (key && typeof key === "string") {
            if (e.code === 'Space') {
                if (!e.repeat) InputComponent.jump[eid] = 1;
            } else {
                (InputComponent as any)[key][eid] = 1;
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        const key = KEY_MAP[e.code];
        if (key && typeof key === "string") (InputComponent as any)[key][eid] = 0;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
            InputComponent.mouseDeltaX[eid] += e.movementX;
            InputComponent.mouseDeltaY[eid] += e.movementY;
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement === canvas) {
            if (e.button === 0) InputComponent.fire[eid] = 1;
            if (e.button === 2) InputComponent.ads[eid] = 1;
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (document.pointerLockElement === canvas) {
            if (e.button === 0) InputComponent.fire[eid] = 0;
            if (e.button === 2) InputComponent.ads[eid] = 0;
        }
    });
}
