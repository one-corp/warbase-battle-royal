import { defineQuery } from "bitecs";
import { world } from "../World";
import { Position, Velocity, InputComponent, PlayerComponent, PlayerTag } from "../Components";
import { entityPhysicsBodies, entityCameras, entityMeshes } from "../ViewMaps";
import { Vector3, Scalar, Ray, PhysicsMotionType } from "@babylonjs/core";

const DEG2RAD = Math.PI / 180;
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

function moveTowards(current: number, target: number, maxDelta: number): number {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
}

const playerQuery = defineQuery([PlayerTag, InputComponent, PlayerComponent]);

export function playerMovementSystem(dt: number, scene: any) {
    const entities = playerQuery(world);

    for (let i = 0; i < entities.length; i++) {
        const eid = entities[i];
        const body = entityPhysicsBodies.get(eid);
        const camera = entityCameras.get(eid);
        const mesh = entityMeshes.get(eid);
        if (!body || !camera || !mesh) continue;

        // Timers
        PlayerComponent.jumpCooldownTimer[eid] = Math.max(0, PlayerComponent.jumpCooldownTimer[eid] - dt);
        PlayerComponent.coyoteTimer[eid] = Math.max(0, PlayerComponent.coyoteTimer[eid] - dt);

        // Ground Check
        const rayStart = mesh.position.clone();
        const rayDir = new Vector3(0, -1, 0);
        const ray = new Ray(rayStart, rayDir, 0.95); 
        const rayResult = scene.pickWithRay(ray, (m: any) => m !== mesh && !m.isDescendantOf(mesh));
        
        const wasGrounded = PlayerComponent.isGrounded[eid] === 1;
        const isGrounded = rayResult?.hit ?? false;
        PlayerComponent.isGrounded[eid] = isGrounded ? 1 : 0;
        
        if (wasGrounded && !isGrounded) PlayerComponent.coyoteTimer[eid] = 0.1;

        // Rotation
        const isAds = InputComponent.ads[eid] === 1;
        const currentSens = isAds ? BASE_SENSITIVITY * 0.5 : BASE_SENSITIVITY;
        
        PlayerComponent.yaw[eid] += InputComponent.mouseDeltaX[eid] * currentSens;
        PlayerComponent.pitch[eid] += InputComponent.mouseDeltaY[eid] * currentSens;
        PlayerComponent.pitch[eid] = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, PlayerComponent.pitch[eid]));
        
        camera.rotation.set(PlayerComponent.pitch[eid], PlayerComponent.yaw[eid], 0);
        
        InputComponent.mouseDeltaX[eid] = 0;
        InputComponent.mouseDeltaY[eid] = 0;

        // FOV / Zoom logic
        let targetFOV = BASE_FOV;
        const isMoving = InputComponent.forward[eid] || InputComponent.backward[eid] || InputComponent.left[eid] || InputComponent.right[eid];
        const isSprinting = InputComponent.sprint[eid] === 1 && InputComponent.forward[eid] === 1 && isGrounded && PlayerComponent.isCrouching[eid] === 0;
        PlayerComponent.isSprinting[eid] = isSprinting ? 1 : 0;

        if (isAds) {
            targetFOV = 50; 
        } else if (isSprinting && isMoving) {
            targetFOV = BASE_FOV + SPRINT_FOV_BOOST;
        }
        camera.fov = Scalar.Lerp(camera.fov, targetFOV * DEG2RAD, FOV_LERP_SPEED * dt);

        // Crouch Toggle
        PlayerComponent.isCrouching[eid] = InputComponent.crouch[eid] === 1 ? 1 : 0;

        // Speed calculation
        let targetSpeed = WALK_SPEED;
        if (isSprinting) targetSpeed = SPRINT_SPEED;
        if (PlayerComponent.isCrouching[eid] === 1) targetSpeed = CROUCH_SPEED;
        if (InputComponent.fire[eid] === 1 && isGrounded && PlayerComponent.isCrouching[eid] === 0) {
            targetSpeed *= 0.6; 
        }

        let dirX = 0, dirZ = 0;
        if (InputComponent.forward[eid]) dirZ += 1;
        if (InputComponent.backward[eid]) dirZ -= 1;
        if (InputComponent.left[eid]) dirX -= 1;
        if (InputComponent.right[eid]) dirX += 1;

        const localDir = new Vector3(dirX, 0, dirZ);
        if (localDir.length() > 0) localDir.normalize();

        const forward = camera.getDirection(Vector3.Forward());
        forward.y = 0;
        const right = camera.getDirection(Vector3.Right());
        right.y = 0;

        if (forward.lengthSquared() < 0.001) {
            forward.set(Math.sin(PlayerComponent.yaw[eid]), 0, Math.cos(PlayerComponent.yaw[eid]));
            right.set(Math.cos(PlayerComponent.yaw[eid]), 0, -Math.sin(PlayerComponent.yaw[eid]));
        } else {
            forward.normalize();
            right.normalize();
        }

        const STRAFE_MULTIPLIER = 0.5; 
        const targetVel = forward.scale(localDir.z).add(right.scale(localDir.x * STRAFE_MULTIPLIER)).scale(targetSpeed);

        const accel = isGrounded ? (localDir.length() > 0 ? GROUND_ACCEL : GROUND_DECEL) : (localDir.length() > 0 ? AIR_ACCEL : AIR_DECEL);

        const currentVel = body.getLinearVelocity();
        
        let platformVel = Vector3.Zero();
        if (isGrounded && rayResult?.pickedMesh?.physicsBody) {
            if (rayResult.pickedMesh.physicsBody.getMotionType() === PhysicsMotionType.ANIMATED) {
                platformVel = rayResult.pickedMesh.physicsBody.getLinearVelocity();
            }
        }

        const localCurrentX = currentVel.x - platformVel.x;
        const localCurrentZ = currentVel.z - platformVel.z;

        const newLocalX = moveTowards(localCurrentX, targetVel.x, accel * dt);
        const newLocalZ = moveTowards(localCurrentZ, targetVel.z, accel * dt);
        
        const newX = newLocalX + platformVel.x;
        const newZ = newLocalZ + platformVel.z;
        let newY = currentVel.y;

        if (InputComponent.jump[eid] && (isGrounded || PlayerComponent.coyoteTimer[eid] > 0) && PlayerComponent.jumpCooldownTimer[eid] <= 0) {
            newY = JUMP_IMPULSE;
            PlayerComponent.isGrounded[eid] = 0;
            PlayerComponent.coyoteTimer[eid] = 0;
            PlayerComponent.jumpCooldownTimer[eid] = JUMP_COOLDOWN;
            InputComponent.jump[eid] = 0; 
        }

        body.setLinearVelocity(new Vector3(newX, newY, newZ));
        body.setAngularVelocity(Vector3.Zero());

        // Camera Lerps
        const targetCamY = PlayerComponent.isCrouching[eid] ? CROUCH_CAM_Y : STAND_CAM_Y;
        camera.position.y = Scalar.Lerp(camera.position.y, targetCamY, CROUCH_LERP_SPEED * dt);

        if (isGrounded && localDir.length() > 0) {
            const freq = isSprinting ? 2.8 : 2.0;
            const ampY = isSprinting ? 0.012 : 0.006;
            const ampX = isSprinting ? 0.010 : 0.005;
            const time = performance.now() * 0.001;
            
            camera.position.y += Math.sin(time * Math.PI * 2 * freq) * ampY;
            camera.position.x = Math.cos(time * Math.PI * freq) * ampX;
        } else {
            camera.position.x = Scalar.Lerp(camera.position.x, 0, 10 * dt);
        }
    }
}
