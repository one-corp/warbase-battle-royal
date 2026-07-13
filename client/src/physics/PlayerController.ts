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
    Scalar,
    Mesh
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

const KEY_MAP: Record<string, keyof InputState> = {
    'KeyW': 'forward', 'KeyS': 'backward', 'KeyA': 'left', 'KeyD': 'right',
    'ShiftLeft': 'sprint', 'Space': 'jump', 'KeyC': 'crouch', 'KeyR': 'reload',
    'Digit1': 'weapon1', 'Digit2': 'weapon2', 'KeyG': 'grenade'
};

function moveTowards(current: number, target: number, maxDelta: number): number {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
}

export class PlayerController {
    public camera: UniversalCamera;
    public mesh: Mesh;
    public aggregate: PhysicsAggregate;

    public input: InputState = {
        forward: false, backward: false, left: false, right: false,
        sprint: false, jump: false, crouch: false,
        fire: false, ads: false, reload: false,
        weapon1: false, weapon2: false, grenade: false,
        mouseDeltaX: 0, mouseDeltaY: 0
    };

    public state = {
        isGrounded: false,
        isCrouching: false,
        isSprinting: false
    };

    private jumpCooldownTimer = 0;
    private coyoteTimer = 0;
    private yaw = 0;
    private pitch = 0;

    private scene: Scene;
    private canvas: HTMLCanvasElement;
    private engine: Engine | WebGPUEngine;

    constructor(scene: Scene, canvas: HTMLCanvasElement, engine: Engine | WebGPUEngine) {
        this.scene = scene;
        this.canvas = canvas;
        this.engine = engine;
        this.setupInputs();

        // Create Player Capsule
        this.mesh = MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
        this.mesh.isVisible = false;
        this.mesh.position.y = 5; // Spawn height

        this.aggregate = new PhysicsAggregate(
            this.mesh, PhysicsShapeType.CAPSULE, 
            { mass: 80, friction: 0.0, restitution: 0 }, 
            scene
        );
        this.aggregate.body.setMassProperties({ inertia: Vector3.ZeroReadOnly });

        // Create Camera
        this.camera = new UniversalCamera("playerCamera", new Vector3(0, 0.6, 0), scene);
        this.camera.parent = this.mesh;
        this.camera.fov = 75 * (Math.PI / 180);
        this.camera.minZ = 0.1;

        scene.onBeforeRenderObservable.add(() => this.update());
    }

    private setupInputs() {
        (window as any).debugKeys = {};
        
        window.addEventListener('keydown', (e) => {
            (window as any).debugKeys[e.key.toLowerCase()] = true;
            if (!KEY_MAP[e.code]) return;
            
            if (e.code === 'Space') {
                if (!e.repeat) this.input.jump = true;
            } else {
                (this.input as any)[KEY_MAP[e.code]] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            (window as any).debugKeys[e.key.toLowerCase()] = false;
            const key = KEY_MAP[e.code];
            if (key) (this.input as any)[key] = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.canvas) {
                this.input.mouseDeltaX += e.movementX;
                this.input.mouseDeltaY += e.movementY;
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (document.pointerLockElement === this.canvas) {
                if (e.button === 0) this.input.fire = true;
                if (e.button === 2) this.input.ads = true;
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (document.pointerLockElement === this.canvas) {
                if (e.button === 0) this.input.fire = false;
                if (e.button === 2) this.input.ads = false;
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    private update() {
        const dt = this.engine.getDeltaTime() / 1000;
        
        // Physics Constants
        const WALK_SPEED = 4.5;
        const SPRINT_SPEED = 5.5; 
        const CROUCH_SPEED = 2.0;
        const GROUND_ACCEL = 40;
        const GROUND_DECEL = 55;
        const AIR_ACCEL = 12;
        const AIR_DECEL = 5;
        const JUMP_IMPULSE = 3.0; 
        const JUMP_COOLDOWN = 0.15;
        const BASE_FOV = 75;
        const SPRINT_FOV_BOOST = 8;
        const FOV_LERP_SPEED = 6;
        const STAND_CAM_Y = 0.6;
        const CROUCH_CAM_Y = 0.3;
        const CROUCH_LERP_SPEED = 10;
        const BASE_SENSITIVITY = 0.002;
        const DEG2RAD = Math.PI / 180;

        this.jumpCooldownTimer = Math.max(0, this.jumpCooldownTimer - dt);
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

        const rayStart = this.mesh.position.clone();
        const rayDir = new Vector3(0, -1, 0);
        const ray = new Ray(rayStart, rayDir, 0.95); 
        
        const rayResult = this.scene.pickWithRay(ray, (mesh) => mesh !== this.mesh && !mesh.isDescendantOf(this.mesh));
        
        const wasGrounded = this.state.isGrounded;
        this.state.isGrounded = rayResult?.hit ?? false;
        
        if (wasGrounded && !this.state.isGrounded) this.coyoteTimer = 0.1;

        // Rotation
        const currentSens = this.input.ads ? BASE_SENSITIVITY * 0.5 : BASE_SENSITIVITY;
        this.yaw += this.input.mouseDeltaX * currentSens;
        this.pitch += this.input.mouseDeltaY * currentSens;
        this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
        this.camera.rotation.set(this.pitch, this.yaw, 0);
        
        this.input.mouseDeltaX = 0;
        this.input.mouseDeltaY = 0;

        // FOV / Zoom logic
        let targetFOV = BASE_FOV;
        const isMoving = (this.input.forward || this.input.backward || this.input.left || this.input.right);
        if (this.input.ads) {
            targetFOV = 50; 
        } else if (this.state.isSprinting && this.state.isGrounded && isMoving) {
            targetFOV = BASE_FOV + SPRINT_FOV_BOOST;
        }
        this.camera.fov = Scalar.Lerp(this.camera.fov, targetFOV * DEG2RAD, FOV_LERP_SPEED * dt);

        // Crouch Toggle
        if (this.input.crouch) {
            this.state.isCrouching = true;
        } else {
            this.state.isCrouching = false;
        }

        // Sprint Check
        this.state.isSprinting = this.input.sprint && this.input.forward && this.state.isGrounded && !this.state.isCrouching;

        // Speed calculation
        let targetSpeed = WALK_SPEED;
        if (this.state.isSprinting) targetSpeed = SPRINT_SPEED;
        if (this.state.isCrouching) targetSpeed = CROUCH_SPEED;
        
        if (this.input.fire && this.state.isGrounded && !this.state.isCrouching) {
            targetSpeed *= 0.6; 
        }

        let dirX = 0, dirZ = 0;
        if (this.input.forward) dirZ += 1;
        if (this.input.backward) dirZ -= 1;
        if (this.input.left) dirX -= 1;
        if (this.input.right) dirX += 1;

        const localDir = new Vector3(dirX, 0, dirZ);
        if (localDir.length() > 0) localDir.normalize();

        const forward = this.camera.getDirection(Vector3.Forward());
        forward.y = 0;
        
        const right = this.camera.getDirection(Vector3.Right());
        right.y = 0;

        if (forward.lengthSquared() < 0.001) {
            forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
            right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        } else {
            forward.normalize();
            right.normalize();
        }

        const STRAFE_MULTIPLIER = 0.5; 
        const targetVel = forward.scale(localDir.z).add(right.scale(localDir.x * STRAFE_MULTIPLIER)).scale(targetSpeed);

        const accel = this.state.isGrounded 
            ? (localDir.length() > 0 ? GROUND_ACCEL : GROUND_DECEL) 
            : (localDir.length() > 0 ? AIR_ACCEL : AIR_DECEL);

        const currentVel = this.aggregate.body.getLinearVelocity();
        const newX = moveTowards(currentVel.x, targetVel.x, accel * dt);
        const newZ = moveTowards(currentVel.z, targetVel.z, accel * dt);
        let newY = currentVel.y;

        // Jump
        if (this.input.jump && (this.state.isGrounded || this.coyoteTimer > 0) && this.jumpCooldownTimer <= 0) {
            newY = JUMP_IMPULSE;
            this.state.isGrounded = false;
            this.coyoteTimer = 0;
            this.jumpCooldownTimer = JUMP_COOLDOWN;
            this.input.jump = false; 
        }

        this.aggregate.body.setLinearVelocity(new Vector3(newX, newY, newZ));
        this.aggregate.body.setAngularVelocity(Vector3.Zero());

        // Camera Lerps
        const targetCamY = this.state.isCrouching ? CROUCH_CAM_Y : STAND_CAM_Y;
        this.camera.position.y = Scalar.Lerp(this.camera.position.y, targetCamY, CROUCH_LERP_SPEED * dt);

        if (this.state.isGrounded && localDir.length() > 0) {
            const freq = this.state.isSprinting ? 2.8 : 2.0;
            const ampY = this.state.isSprinting ? 0.012 : 0.006;
            const ampX = this.state.isSprinting ? 0.010 : 0.005;
            const time = performance.now() * 0.001;
            
            this.camera.position.y += Math.sin(time * Math.PI * 2 * freq) * ampY;
            this.camera.position.x = Math.cos(time * Math.PI * freq) * ampX;
        } else {
            this.camera.position.x = Scalar.Lerp(this.camera.position.x, 0, 10 * dt);
        }
    }
}
