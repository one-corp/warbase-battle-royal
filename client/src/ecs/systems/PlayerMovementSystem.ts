import { defineQuery } from "bitecs";
import { world } from "../World";
import { InputComponent, PlayerComponent, PlayerTag } from "../Components";
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
const JUMP_IMPULSE = 3.5; 
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

const _groundRay = new Ray(Vector3.Zero(), new Vector3(0, -1, 0), 0.95);
const _tempForward = new Vector3();
const _tempRight = new Vector3();
const _targetVel = new Vector3();
const _currentVel = new Vector3();
const _platformVel = new Vector3();
const _newVel = new Vector3();

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
        _groundRay.origin.copyFrom(mesh.position);
        const rayResult = scene.pickWithRay(_groundRay, (m: any) => m !== mesh && !m.isDescendantOf(mesh));
        
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

        camera.getDirectionToRef(Vector3.Forward(), _tempForward);
        _tempForward.y = 0;
        camera.getDirectionToRef(Vector3.Right(), _tempRight);
        _tempRight.y = 0;

        if (_tempForward.lengthSquared() < 0.001) {
            _tempForward.set(Math.sin(PlayerComponent.yaw[eid]), 0, Math.cos(PlayerComponent.yaw[eid]));
            _tempRight.set(Math.cos(PlayerComponent.yaw[eid]), 0, -Math.sin(PlayerComponent.yaw[eid]));
        } else {
            _tempForward.normalize();
            _tempRight.normalize();
        }

        const STRAFE_MULTIPLIER = 0.5; 
        
        _targetVel.copyFrom(_tempForward).scaleInPlace(localDir.z);
        _targetVel.addInPlace(_tempRight.scaleInPlace(localDir.x * STRAFE_MULTIPLIER));
        _targetVel.scaleInPlace(targetSpeed);

        const accel = isGrounded ? (localDir.length() > 0 ? GROUND_ACCEL : GROUND_DECEL) : (localDir.length() > 0 ? AIR_ACCEL : AIR_DECEL);

        body.getLinearVelocityToRef(_currentVel);
        
        _platformVel.copyFrom(Vector3.Zero());
        if (isGrounded && rayResult?.pickedMesh?.physicsBody) {
            if (rayResult.pickedMesh.physicsBody.getMotionType() === PhysicsMotionType.ANIMATED) {
                rayResult.pickedMesh.physicsBody.getLinearVelocityToRef(_platformVel);
            }
        }

        const localCurrentX = _currentVel.x - _platformVel.x;
        const localCurrentZ = _currentVel.z - _platformVel.z;

        const newLocalX = moveTowards(localCurrentX, _targetVel.x, accel * dt);
        const newLocalZ = moveTowards(localCurrentZ, _targetVel.z, accel * dt);
        
        const newX = newLocalX + _platformVel.x;
        const newZ = newLocalZ + _platformVel.z;
        let newY = _currentVel.y;

        if (InputComponent.jump[eid] && (isGrounded || PlayerComponent.coyoteTimer[eid] > 0) && PlayerComponent.jumpCooldownTimer[eid] <= 0) {
            newY = JUMP_IMPULSE;
            PlayerComponent.isGrounded[eid] = 0;
            PlayerComponent.coyoteTimer[eid] = 0;
            PlayerComponent.jumpCooldownTimer[eid] = JUMP_COOLDOWN;
        }

        _newVel.set(newX, newY, newZ);
        body.setLinearVelocity(_newVel);
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

        // Always clear jump intent at the end of the frame so it doesn't get stuck if pressed mid-air
        InputComponent.jump[eid] = 0;
    }
}
