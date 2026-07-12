import {
    Scene,
    Vector3,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    Ray,
    Engine,
    WebGPUEngine,
    UniversalCamera,
    Scalar
} from "@babylonjs/core";

export interface InputState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    sprint: boolean;
    jump: boolean;
    crouch: boolean;
    fire: boolean;
    ads: boolean;
    reload: boolean;
    weapon1: boolean;
    weapon2: boolean;
    grenade: boolean;
    mouseDeltaX: number;
    mouseDeltaY: number;
}

export const input: InputState = {
    forward: false, backward: false, left: false, right: false,
    sprint: false, jump: false, crouch: false,
    fire: false, ads: false, reload: false,
    weapon1: false, weapon2: false, grenade: false,
    mouseDeltaX: 0, mouseDeltaY: 0
};

const KEY_MAP: Record<string, keyof InputState> = {
    'KeyW': 'forward', 'KeyS': 'backward', 'KeyA': 'left', 'KeyD': 'right',
    'ShiftLeft': 'sprint', 'Space': 'jump', 'KeyC': 'crouch', 'KeyR': 'reload',
    'Digit1': 'weapon1', 'Digit2': 'weapon2', 'KeyG': 'grenade'
};

export function setupInputs(canvas: HTMLCanvasElement) {
    (window as any).debugKeys = {};
    
    window.addEventListener('keydown', (e) => {
        (window as any).debugKeys[e.key.toLowerCase()] = true;
        const key = KEY_MAP[e.code];
        if (key) (input as any)[key] = true;
    });

    window.addEventListener('keyup', (e) => {
        (window as any).debugKeys[e.key.toLowerCase()] = false;
        const key = KEY_MAP[e.code];
        if (key) (input as any)[key] = false;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
            input.mouseDeltaX += e.movementX;
            input.mouseDeltaY += e.movementY;
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (document.pointerLockElement === canvas) {
            if (e.button === 0) (input as any).fire = true;
            if (e.button === 2) (input as any).ads = true;
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (document.pointerLockElement === canvas) {
            if (e.button === 0) (input as any).fire = false;
            if (e.button === 2) (input as any).ads = false;
        }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function moveTowards(current: number, target: number, maxDelta: number): number {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
}

export let playerState = {
    isGrounded: false,
    isCrouching: false,
    isSprinting: false
};

export function setupPlayer(scene: Scene, canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine): UniversalCamera {
    setupInputs(canvas);

    // Physics Constants
    const WALK_SPEED = 4.5;
    const SPRINT_SPEED = 5.5; // Reduced from 6.5
    const CROUCH_SPEED = 2.0;
    
    const GROUND_ACCEL = 40;
    const GROUND_DECEL = 55;
    const AIR_ACCEL = 12;
    const AIR_DECEL = 5;

    const JUMP_IMPULSE = 5.5; // Reduced from 6.6
    const JUMP_COOLDOWN = 0.15;

    const BASE_FOV = 75;
    const SPRINT_FOV_BOOST = 8;
    const FOV_LERP_SPEED = 6;

    const STAND_CAM_Y = 0.7;
    const CROUCH_CAM_Y = 0.3;
    const CROUCH_LERP_SPEED = 10;

    const BASE_SENSITIVITY = 0.002;
    const DEG2RAD = Math.PI / 180;

    // Create Player Capsule
    const playerMesh = MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
    playerMesh.isVisible = false;
    playerMesh.position.y = 5; // Spawn height

    const playerAggregate = new PhysicsAggregate(
        playerMesh, PhysicsShapeType.CAPSULE, 
        { mass: 80, friction: 0.0, restitution: 0 }, // 0 friction so we don't stick to walls
        scene
    );
    playerAggregate.body.setMassProperties({ inertia: Vector3.ZeroReadOnly }); // Prevent tipping
    playerAggregate.body.setGravityFactor(1.5); // Increase gravity fall speed for snappiness

    // Create Camera
    const camera = new UniversalCamera("playerCamera", new Vector3(0, STAND_CAM_Y, 0), scene);
    camera.parent = playerMesh;
    camera.fov = BASE_FOV * DEG2RAD;
    camera.minZ = 0.1;

    // State Variables
    let isGrounded = false;
    let isCrouching = false;
    let isSprinting = false;
    let jumpCooldownTimer = 0;
    let coyoteTimer = 0;
    let yaw = 0;
    let pitch = 0;

    playerState = {
        get isGrounded() { return isGrounded; },
        get isCrouching() { return isCrouching; },
        get isSprinting() { return isSprinting; }
    };

    scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        
        jumpCooldownTimer = Math.max(0, jumpCooldownTimer - dt);
        coyoteTimer = Math.max(0, coyoteTimer - dt);

        const rayStart = playerMesh.position.clone();
        const rayDir = new Vector3(0, -1, 0);
        const ray = new Ray(rayStart, rayDir, 1.0);
        
        const rayResult = scene.pickWithRay(ray, (mesh) => mesh !== playerMesh);
        
        const wasGrounded = isGrounded;
        isGrounded = rayResult?.hit ?? false;
        
        if (wasGrounded && !isGrounded) coyoteTimer = 0.1;

        // Rotation
        const currentSens = input.ads ? BASE_SENSITIVITY * 0.5 : BASE_SENSITIVITY;
        yaw += input.mouseDeltaX * currentSens;
        pitch += input.mouseDeltaY * currentSens;
        pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, pitch));
        camera.rotation.set(pitch, yaw, 0);
        
        input.mouseDeltaX = 0;
        input.mouseDeltaY = 0;

        // FOV / Zoom logic
        let targetFOV = BASE_FOV;
        const isMoving = (input.forward || input.backward || input.left || input.right);
        if (input.ads) {
            targetFOV = 50; // ADS Zoom
        } else if (isSprinting && isGrounded && isMoving) {
            targetFOV = BASE_FOV + SPRINT_FOV_BOOST;
        }
        camera.fov = Scalar.Lerp(camera.fov, targetFOV * DEG2RAD, FOV_LERP_SPEED * dt);

        // Crouch Toggle
        if (input.crouch) {
            isCrouching = true;
            // TODO: Scale down capsule
        } else {
            // TODO: Stand up check
            isCrouching = false;
        }

        // Sprint Check
        isSprinting = input.sprint && input.forward && isGrounded && !isCrouching;

        // Speed calculation
        let targetSpeed = WALK_SPEED;
        if (isSprinting) targetSpeed = SPRINT_SPEED;
        if (isCrouching) targetSpeed = CROUCH_SPEED;
        
        // Firing penalty (slower tactical movement)
        if (input.fire && isGrounded && !isCrouching) {
            targetSpeed *= 0.6; // e.g., 4.5 becomes 2.7
        }

        // Input Direction in World Space
        let dirX = 0, dirZ = 0;
        if (input.forward) dirZ += 1;
        if (input.backward) dirZ -= 1;
        if (input.left) dirX -= 1;
        if (input.right) dirX += 1;

        const localDir = new Vector3(dirX, 0, dirZ);
        if (localDir.length() > 0) localDir.normalize();

        const forward = camera.getDirection(Vector3.Forward());
        forward.y = 0;
        
        const right = camera.getDirection(Vector3.Right());
        right.y = 0;

        if (forward.lengthSquared() < 0.001) {
            // Fallback if looking straight up/down
            forward.set(Math.sin(yaw), 0, Math.cos(yaw));
            right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        } else {
            forward.normalize();
            right.normalize();
        }

        const targetVel = forward.scale(localDir.z).add(right.scale(localDir.x)).scale(targetSpeed);

        // Acceleration
        const accel = isGrounded 
            ? (localDir.length() > 0 ? GROUND_ACCEL : GROUND_DECEL) 
            : (localDir.length() > 0 ? AIR_ACCEL : AIR_DECEL);

        const currentVel = playerAggregate.body.getLinearVelocity();
        const newX = moveTowards(currentVel.x, targetVel.x, accel * dt);
        const newZ = moveTowards(currentVel.z, targetVel.z, accel * dt);
        let newY = currentVel.y;

        // Jump
        if (input.jump && (isGrounded || coyoteTimer > 0) && jumpCooldownTimer <= 0) {
            newY = JUMP_IMPULSE;
            isGrounded = false;
            coyoteTimer = 0;
            jumpCooldownTimer = JUMP_COOLDOWN;
        }

        // Apply Velocity
        playerAggregate.body.setLinearVelocity(new Vector3(newX, newY, newZ));
        playerAggregate.body.setAngularVelocity(Vector3.Zero());

        // Camera Lerps
        const targetCamY = isCrouching ? CROUCH_CAM_Y : STAND_CAM_Y;
        camera.position.y = Scalar.Lerp(camera.position.y, targetCamY, CROUCH_LERP_SPEED * dt);
        
        // Head Bob (simple)
        if (isGrounded && localDir.length() > 0) {
            const freq = isSprinting ? 3.0 : 2.5;
            const amp = isSprinting ? 0.015 : 0.01; // Reduced shake
            const time = performance.now() * 0.001;
            camera.position.y += Math.sin(time * Math.PI * 2 * freq) * amp;
        }
    });

    return camera;
}
