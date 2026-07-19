import { AdvancedDynamicTexture, Rectangle } from "@babylonjs/gui";
import { defineQuery, type IWorld } from "bitecs";
import { 
    Scene, MeshBuilder, Color3, Vector3, Matrix, TransformNode, ParticleSystem, Color4, 
    AbstractMesh, Mesh, Scalar, SceneLoader, StandardMaterial, PhysicsMotionType 
} from "@babylonjs/core";

import type { NetworkManager } from "../network/NetworkManager";
import { initDecalSystem, spawnDecal } from "../ecs/systems/DecalSystem";
import { initTracerSystem, spawnTracer } from "../ecs/systems/TracerSystem";
import { initImpactSystem, spawnImpact } from "../ecs/systems/ImpactSystem";
import { throwNetworkGrenade } from "./GrenadeSystem";
import { 
    entityCameras, entityPhysicsBodies, entitySwayRoots, entityWeaponSocketOffsets,
    entityAKRoots, entityPistolRoots, entityAimPoints, entityFlashParticles, entityShellParticles 
} from "../ecs/ViewMaps";
import { WeaponStateComponent, RecoilComponent, SwayComponent, InputComponent, PlayerComponent } from "../ecs/Components";

// @ts-ignore
        const DEG2RAD = Math.PI / 180;

export interface WeaponConfig {
    id: string; damage: number; headshotMultiplier: number; fireRate: number; magSize: number;
    reloadTime: number; baseSpread: number; bloomPerShot: number; maxSpread: number; bloomRecovery: number;
    recoilVertical: number; recoilHorizontal: number; recoilRecovery: number; adsFOV: number;
    adsTime: number; adsSpreadMult: number; adsRecoilMult: number; hipPosition: Vector3; adsPosition: Vector3;
}

export const WEAPON_CONFIGS: WeaponConfig[] = [
    { // 0: AK47
        id: 'ak47', damage: 34, headshotMultiplier: 2.5, fireRate: 600, magSize: 30, reloadTime: 2.5,
        baseSpread: 1.5, bloomPerShot: 0.4, maxSpread: 5.0, bloomRecovery: 8.0,
        recoilVertical: 0.05, recoilHorizontal: 0.02, recoilRecovery: 6.0, adsFOV: 55,
        adsTime: 0.2, adsSpreadMult: 0.4, adsRecoilMult: 0.7, 
        hipPosition: new Vector3(0.3, -0.3, 0.6), adsPosition: new Vector3(0.0, -0.15, 0.4),
    },
    { // 1: PISTOL
        id: 'pistol', damage: 25, headshotMultiplier: 3.0, fireRate: 400, magSize: 12, reloadTime: 1.5,
        baseSpread: 1.0, bloomPerShot: 0.8, maxSpread: 6.0, bloomRecovery: 12.0,
        recoilVertical: 0.08, recoilHorizontal: 0.01, recoilRecovery: 10.0, adsFOV: 65,
        adsTime: 0.12, adsSpreadMult: 0.2, adsRecoilMult: 0.5, 
        hipPosition: new Vector3(0.2, -0.2, 0.5), adsPosition: new Vector3(0.0, -0.1, 0.35),
    }
];

export const createWeaponSystem = (scene: Scene, networkManager?: NetworkManager) => {
    const weaponQuery = defineQuery([WeaponStateComponent, RecoilComponent, SwayComponent, InputComponent, PlayerComponent]);
    let lastGrenadeThrow = 0;
    const _tempReloadOffset = new Vector3();
    const _tempBasePos = new Vector3();
    const _tempForward = new Vector3();
    const _tempRight = new Vector3();
    const _tempUp = new Vector3();
    const _tempSpreadDir = new Vector3();
    const _tempEndPoint = new Vector3();
    const _tempDesiredWorldPos = new Vector3();
    const _tempCurrentAimWorldPos = new Vector3();
    const _tempDeltaWorldPos = new Vector3();
    const _tempInvertedCameraMatrix = new Matrix();
    const _tempLocalDelta = new Vector3();
    const _tempMathematicalADSPos = new Vector3();
    const _tempHipfirePos = new Vector3();
    const _tempCurrentTargetPos = new Vector3();
    const _tempStartPoint = new Vector3();
    const _tempOffset = new Vector3(0, -0.2, 0);
    const _tempDirection = new Vector3();
    const _Forward = new Vector3(0, 0, 1);
    const _Right = new Vector3(1, 0, 0);
    const _Up = new Vector3(0, 1, 0);

    return (world: IWorld, dt: number) => {
        const ents = weaponQuery(world);
        for (let i = 0; i < ents.length; i++) {
            const eid = ents[i];
            const config = WEAPON_CONFIGS[WeaponStateComponent.activeWeaponIndex[eid]];
            const camera = entityCameras.get(eid);
            const swayRoot = entitySwayRoots.get(eid);
            const aimPoint = entityAimPoints.get(eid);
            const flash = entityFlashParticles.get(eid);
            const shellEjector = entityShellParticles.get(eid);
            const socketOffset = entityWeaponSocketOffsets.get(eid);

            if (!camera || !swayRoot || !aimPoint || !socketOffset) continue;

            // @ts-ignore
            const isGrounded = PlayerComponent.isGrounded[eid] === 1;
            const wantsToFire = InputComponent.fire[eid] === 1;
            const inputAds = InputComponent.ads[eid] === 1;
            const inputReload = InputComponent.reload[eid] === 1;
            const isMoving = InputComponent.forward[eid] || InputComponent.backward[eid] || InputComponent.left[eid] || InputComponent.right[eid];

            // 1. Process Reload
            _tempReloadOffset.set(0, 0, 0);
            let reloadRotX = 0;

            if (WeaponStateComponent.isReloading[eid]) {
                WeaponStateComponent.reloadTimer[eid] += dt;
                const progress = WeaponStateComponent.reloadTimer[eid] / config.reloadTime;
                
                if (progress < 0.2) {
                    const t = progress / 0.2;
                    _tempReloadOffset.y = Scalar.Lerp(0, -0.4, t);
                    reloadRotX = Scalar.Lerp(0, Math.PI / 4, t);
                } else if (progress < 0.8) {
                    _tempReloadOffset.y = -0.4;
                    reloadRotX = Math.PI / 4;
                } else {
                    const t = (progress - 0.8) / 0.2;
                    _tempReloadOffset.y = Scalar.Lerp(-0.4, 0, t);
                    reloadRotX = Scalar.Lerp(Math.PI / 4, 0, t);
                }

                if (progress >= 1.0) {
                    WeaponStateComponent.currentAmmo[eid] = config.magSize;
                    WeaponStateComponent.isReloading[eid] = 0;
                    const event = new CustomEvent('ammo-update', { detail: { ammo: config.magSize, max: config.magSize } });
                    window.dispatchEvent(event);
                }
            } else if ((inputReload || (wantsToFire && WeaponStateComponent.currentAmmo[eid] === 0)) && WeaponStateComponent.currentAmmo[eid] < config.magSize) {
                WeaponStateComponent.isReloading[eid] = 1;
                WeaponStateComponent.reloadTimer[eid] = 0;
                if (networkManager) networkManager.sendReload();
            }

            // 2. Process ADS
            const isADS = inputAds && !WeaponStateComponent.isReloading[eid];
            const targetADS = isADS ? 1.0 : 0.0;
            const currentADS = WeaponStateComponent.adsProgress[eid];
            WeaponStateComponent.adsProgress[eid] += (targetADS - currentADS) * (dt / config.adsTime);
            if (WeaponStateComponent.adsProgress[eid] > 1) WeaponStateComponent.adsProgress[eid] = 1;
            if (WeaponStateComponent.adsProgress[eid] < 0) WeaponStateComponent.adsProgress[eid] = 0;

            // 3. Process Firing
            const canFire = WeaponStateComponent.currentAmmo[eid] > 0 && !WeaponStateComponent.isReloading[eid];
            // @ts-ignore
            const fireInterval = 1.0 / (config.fireRate / 60.0); // frames at 60hz

            if (wantsToFire && canFire && performance.now() - WeaponStateComponent.lastFireTime[eid] >= (60000 / config.fireRate)) {
                WeaponStateComponent.lastFireTime[eid] = performance.now();
                WeaponStateComponent.currentAmmo[eid]--;
                
                const event = new CustomEvent('ammo-update', { detail: { ammo: WeaponStateComponent.currentAmmo[eid], max: config.magSize } });
                window.dispatchEvent(event);
                
                if (networkManager) networkManager.sendFire();

                // Apply Recoil
                const mult = isADS ? config.adsRecoilMult : 1.0;
                RecoilComponent.offsetY[eid] -= config.recoilVertical * mult;
                RecoilComponent.offsetX[eid] += (Math.random() - 0.5) * 2 * config.recoilHorizontal * mult;
                
                WeaponStateComponent.currentSpread[eid] = Math.min(WeaponStateComponent.currentSpread[eid] + config.bloomPerShot, config.maxSpread);
                
                RecoilComponent.kickbackZ[eid] = isADS ? -0.02 : -0.05;
                RecoilComponent.kickbackRotX[eid] = isADS ? -0.02 : -0.08; 
                
                if (flash) {
                    flash.manualEmitCount = 5;
                    flash.targetStopDuration = 0.05;
                    flash.start();
                }
                if (shellEjector) {
                    shellEjector.manualEmitCount = 1;
                    shellEjector.start();
                }

                // Raycast math
                const spreadAngle = WeaponStateComponent.currentSpread[eid] * DEG2RAD * (isADS ? config.adsSpreadMult : 1.0);
                const rot = Math.random() * Math.PI * 2;
                
                camera.getDirectionToRef(_Forward, _tempForward);
                camera.getDirectionToRef(_Right, _tempRight);
                camera.getDirectionToRef(_Up, _tempUp);
                
                _tempSpreadDir.copyFrom(_tempForward);
                _tempRight.scaleInPlace(Math.sin(spreadAngle) * Math.cos(rot));
                _tempUp.scaleInPlace(Math.sin(spreadAngle) * Math.sin(rot));
                _tempSpreadDir.addInPlace(_tempRight).addInPlace(_tempUp).normalize();

                _tempEndPoint.copyFrom(_tempSpreadDir).scaleInPlace(300).addInPlace(camera.globalPosition);
                let hitPoint = _tempEndPoint;
                
                const query: any = { shouldHitTriggers: true };
                const localBody = entityPhysicsBodies.get(eid);
                if (localBody) query.ignoreBody = localBody;

                const physResult = scene.getPhysicsEngine()?.raycast(camera.globalPosition, _tempEndPoint, query);

                if (physResult && physResult.hasHit && physResult.body && physResult.body.transformNode) {
                    hitPoint = physResult.hitPointWorld;
                    const hitMesh = physResult.body.transformNode;

                    if (hitMesh.physicsBody && hitMesh.physicsBody.getMotionType() === PhysicsMotionType.DYNAMIC) {
                        hitMesh.physicsBody.applyImpulse(_tempSpreadDir.scale(10), hitPoint);
                    }
                    
                    if (hitMesh.metadata && hitMesh.metadata.isHitbox && hitMesh.metadata.playerId && hitMesh.metadata.playerId !== networkManager?.username) {
                        if (networkManager) {
                            const targetId = hitMesh.metadata.playerId;
                            const hmult = hitMesh.metadata.multiplier || 1.0;
                            const finalDamage = Math.round(config.damage * hmult);
                            networkManager.sendHit(targetId, finalDamage);
                        }
                    } else if (!hitMesh.metadata?.playerId) {
                        const normal = physResult.hitNormalWorld;
                        const decalPos = hitPoint.add(normal.scale(0.02));
                        spawnDecal(decalPos, decalPos.add(normal));
                        spawnImpact(hitPoint, normal);
                    }
                }
                camera.globalPosition.addToRef(_tempOffset, _tempStartPoint);
                spawnTracer(_tempStartPoint, hitPoint);
            }

            // 4. Process Sway / Bob
            if (isMoving && !WeaponStateComponent.isReloading[eid]) {
                const bobSpeed = InputComponent.sprint[eid] ? 15 : 10;
                SwayComponent.walkBobTimer[eid] += dt * bobSpeed;
            } else {
                SwayComponent.walkBobTimer[eid] = 0;
            }

            const swayTargetX = -InputComponent.mouseDeltaX[eid] * 0.001;
            const swayTargetY = -InputComponent.mouseDeltaY[eid] * 0.001;
            SwayComponent.swayX[eid] = Scalar.Lerp(SwayComponent.swayX[eid], swayTargetX, 10 * dt);
            SwayComponent.swayY[eid] = Scalar.Lerp(SwayComponent.swayY[eid], swayTargetY, 10 * dt);

            let bobX = 0;
            let bobY = 0;
            if (isMoving && !WeaponStateComponent.isReloading[eid]) {
                const bobAmp = InputComponent.sprint[eid] ? 0.012 : 0.01;
                bobX = Math.sin(SwayComponent.walkBobTimer[eid]) * bobAmp;
                bobY = Math.abs(Math.cos(SwayComponent.walkBobTimer[eid])) * bobAmp; 
            } else {
                const t = performance.now() * 0.001;
                bobY = Math.sin(t * 1.5) * 0.003;
            }

            // 5. Apply ECS state to Babylon Meshes
            WeaponStateComponent.currentSpread[eid] = Math.max(config.baseSpread, WeaponStateComponent.currentSpread[eid] - config.bloomRecovery * dt);
            
            RecoilComponent.offsetX[eid] = Scalar.Lerp(RecoilComponent.offsetX[eid], 0, config.recoilRecovery * dt);
            RecoilComponent.offsetY[eid] = Scalar.Lerp(RecoilComponent.offsetY[eid], 0, config.recoilRecovery * dt);
            
            PlayerComponent.pitch[eid] += RecoilComponent.offsetY[eid];
            PlayerComponent.yaw[eid] += RecoilComponent.offsetX[eid];

            Vector3.LerpToRef(Vector3.ZeroReadOnly, config.adsPosition, WeaponStateComponent.adsProgress[eid], _tempBasePos);
            
            camera.getDirectionToRef(_Forward, _tempDirection);
            _tempDirection.scaleInPlace(0.3);
            camera.globalPosition.addToRef(_tempDirection, _tempDesiredWorldPos);

            _tempCurrentAimWorldPos.copyFrom(aimPoint.getAbsolutePosition());
            _tempDesiredWorldPos.subtractToRef(_tempCurrentAimWorldPos, _tempDeltaWorldPos);

            if (InputComponent.grenade[eid] === 1 && performance.now() - lastGrenadeThrow > 1000) {
                lastGrenadeThrow = performance.now();
                const forward = camera.getDirection(Vector3.Forward());
                const pos = camera.globalPosition.add(forward.scale(1.5));
                const throwDir = forward.add(new Vector3(0, 0.2, 0)).normalize();
                const vel = throwDir.scale(25);
                
                throwNetworkGrenade(scene, pos, vel);
                if (networkManager) {
                    networkManager.sendGrenade(pos, vel);
                }
            }

            _tempInvertedCameraMatrix.copyFrom(camera.getWorldMatrix());
            _tempInvertedCameraMatrix.invert();

            Vector3.TransformNormalToRef(_tempDeltaWorldPos, _tempInvertedCameraMatrix, _tempLocalDelta);
            swayRoot.position.addToRef(_tempLocalDelta, _tempMathematicalADSPos);

            _tempBasePos.addToRef(_tempReloadOffset, _tempHipfirePos);
            Vector3.LerpToRef(_tempHipfirePos, _tempMathematicalADSPos, WeaponStateComponent.adsProgress[eid], _tempCurrentTargetPos);
            
            const adsSwayMult = 1.0 - (WeaponStateComponent.adsProgress[eid] * 0.8); 
            swayRoot.rotation.y = SwayComponent.swayX[eid] * adsSwayMult;
            swayRoot.rotation.x = reloadRotX + (SwayComponent.swayY[eid] * adsSwayMult) + RecoilComponent.kickbackRotX[eid]; 
            
            swayRoot.position.copyFrom(_tempCurrentTargetPos);
            swayRoot.position.x += (bobX * adsSwayMult);
            swayRoot.position.y += (bobY * adsSwayMult);
            swayRoot.position.z += RecoilComponent.kickbackZ[eid];
            
            RecoilComponent.kickbackZ[eid] = Scalar.Lerp(RecoilComponent.kickbackZ[eid], 0, 15 * dt); 
            RecoilComponent.kickbackRotX[eid] = Scalar.Lerp(RecoilComponent.kickbackRotX[eid], 0, 15 * dt); 
            
            // Note: Animations could be added here if we hook up the AnimationGroups to ViewMaps
        }
        return world;
    };
};



export const createMuzzleFlash = (parent: AbstractMesh, scene: Scene): ParticleSystem => {
    const ps = new ParticleSystem("muzzleFlash", 15, scene);
    ps.particleTexture = null as any; 
    ps.emitter = parent;
    ps.emitRate = 0;
    ps.minLifeTime = 0.03;
    ps.maxLifeTime = 0.08;
    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(1.0, 0.8, 0.3, 1.0);
    ps.colorDead = new Color4(1.0, 0.2, 0.0, 0.0);
    return ps;
};



export const createShellEjector = (parent: AbstractMesh, scene: Scene): ParticleSystem => {
    const ps = new ParticleSystem("shells", 10, scene);
    ps.particleTexture = null as any; 
    ps.emitter = parent;
    ps.emitRate = 0;
    ps.minLifeTime = 1.0;
    ps.maxLifeTime = 1.5;
    ps.minSize = 0.03;
    ps.maxSize = 0.04;
    ps.color1 = new Color4(0.8, 0.7, 0.2, 1.0); 
    ps.color2 = new Color4(0.7, 0.6, 0.1, 1.0);
    ps.colorDead = new Color4(0.5, 0.4, 0.1, 0.0);
    ps.direction1 = new Vector3(1, 1, 0);
    ps.direction2 = new Vector3(2, 2, 0.5);
    ps.gravity = new Vector3(0, -9.81, 0);
    return ps;
};


export const initWeapons = async (playerEid: number, scene: Scene, networkManager?: NetworkManager) => {

        initDecalSystem(scene);
        initTracerSystem(scene);
        initImpactSystem(scene);
        
        const camera = entityCameras.get(playerEid);
        if (!camera) throw new Error("Player camera not found in ECS view map");
        
        const oldRoot = scene.getNodeByName("swayRoot");
        if (oldRoot) oldRoot.dispose();
        
        const swayRoot = new TransformNode("swayRoot", scene);
        swayRoot.parent = camera;

        const container = await SceneLoader.LoadAssetContainerAsync("./models/", `AnimatedSoldier.glb?v=${Date.now()}`, scene);
        const entries = container.instantiateModelsToScene();
        const viewmodelRoot = entries.rootNodes[0] as TransformNode;
        viewmodelRoot.parent = swayRoot;
        viewmodelRoot.position = new Vector3(0, -1.6, -0.4); 
        viewmodelRoot.rotation = new Vector3(0, 0, 0); 
        
        viewmodelRoot.getChildMeshes().forEach((m: any) => {
            m.alwaysSelectAsActiveMesh = true;
            m.isPickable = false;
        });

        const animGroups = entries.animationGroups;
        animGroups.forEach((ag: any) => {
            if (ag.targetedAnimations) {
                const isFiring = ag.name.toLowerCase().includes("fire") || ag.name.toLowerCase().includes("firing");
                ag.targetedAnimations.forEach((ta: any) => {
                    ta.animation.enableBlending = !isFiring;
                    ta.animation.blendingSpeed = 0.05; 
                });
            }
        });

        // @ts-ignore
        let currentAnim = "";
        // @ts-ignore
        const playAnim = (name: string, forceRestart: boolean = false) => {
            if (currentAnim === name && !forceRestart) return;
            
            const targetAnim = animGroups.find((ag: any) => {
                const agName = ag.name.toLowerCase();
                if (name === "firing") return agName.includes("firing") && !agName.includes("walk");
                return agName.includes(name);
            });
            
            const currentAg = animGroups.find((ag: any) => ag.name.toLowerCase().includes(currentAnim));
            if (currentAg) currentAg.stop();

            if (targetAnim) {
                targetAnim.start(true, 1.0, targetAnim.from, targetAnim.to, false);
                currentAnim = name;
            } else if (name === "idle") {
                const fallback = animGroups.find((ag: any) => ag.name.toLowerCase().includes("tpose"));
                if (fallback) {
                    fallback.start(true, 1.0, fallback.from, fallback.to, false);
                    // @ts-ignore
        let currentAnim = "idle";
                }
            }
        };

        // @ts-ignore
        playAnim("idle");

        const weaponSocketRoot = new TransformNode("WeaponSocketRoot", scene);
        const weaponSocketOffset = new TransformNode("WeaponSocketOffset", scene);
        weaponSocketOffset.parent = weaponSocketRoot;

        let rightHandBone: any = null;
        if (entries.skeletons && entries.skeletons.length > 0) {
            entries.skeletons[0].bones.forEach((bone: any) => {
                if (bone.name.includes("RightHand")) rightHandBone = bone;
            });
        }

        if (rightHandBone) {
            weaponSocketRoot.attachToBone(rightHandBone, viewmodelRoot);
        } else {
            weaponSocketRoot.parent = swayRoot;
        }
        
        let socketPos = new Vector3(0, 0, 0);
        let socketRot = new Vector3(Math.PI / 2, 0, 0); 
        weaponSocketOffset.position = socketPos;
        weaponSocketOffset.rotation = socketRot;

        const gunmetal = new StandardMaterial("gunmetal", scene);
        gunmetal.diffuseColor = new Color3(0.2, 0.2, 0.2);
        gunmetal.specularColor = new Color3(0.5, 0.5, 0.5);
        
        const matteBlack = new StandardMaterial("matteBlack", scene);
        matteBlack.diffuseColor = new Color3(0.05, 0.05, 0.05);

        const akRoot = new TransformNode("ak47", scene);
        akRoot.parent = weaponSocketOffset;
        
        const akGrip = MeshBuilder.CreateBox("akGrip", { width: 0.04, height: 0.12, depth: 0.06 }, scene);
        akGrip.position = new Vector3(0, -0.06, 0);
        akGrip.rotation.x = Math.PI / 8;
        akGrip.material = matteBlack;
        akGrip.parent = akRoot;
        
        const akReceiver = MeshBuilder.CreateBox("akReceiver", { width: 0.05, height: 0.08, depth: 0.3 }, scene);
        akReceiver.position = new Vector3(0, 0.04, 0.1);
        akReceiver.material = gunmetal;
        akReceiver.parent = akRoot;
        
        const akBarrel = MeshBuilder.CreateCylinder("akBarrel", { diameter: 0.02, height: 0.4 }, scene);
        akBarrel.rotation.x = Math.PI / 2;
        akBarrel.position = new Vector3(0, 0.06, 0.45);
        akBarrel.material = gunmetal;
        akBarrel.parent = akRoot;

        const akMag = MeshBuilder.CreateBox("akMag", { width: 0.04, height: 0.15, depth: 0.08 }, scene);
        akMag.rotation.x = -Math.PI / 8;
        akMag.position = new Vector3(0, -0.05, 0.2);
        akMag.material = matteBlack;
        akMag.parent = akRoot;

        const akStock = MeshBuilder.CreateBox("akStock", { width: 0.04, height: 0.08, depth: 0.2 }, scene);
        akStock.position = new Vector3(0, 0.02, -0.15);
        akStock.material = gunmetal;
        akStock.parent = akRoot;

        akRoot.getChildMeshes().forEach((m: any) => {
            m.alwaysSelectAsActiveMesh = true;
            m.isPickable = false;
        });

        const pistolRoot = new TransformNode("pistol", scene);
        pistolRoot.parent = weaponSocketOffset;
        
        const pistolGrip = MeshBuilder.CreateBox("pistolGrip", { width: 0.03, height: 0.1, depth: 0.05 }, scene);
        pistolGrip.position = new Vector3(0, -0.05, 0);
        pistolGrip.rotation.x = Math.PI / 16;
        pistolGrip.material = matteBlack;
        pistolGrip.parent = pistolRoot;
        
        const pistolReceiver = MeshBuilder.CreateBox("pistolReceiver", { width: 0.04, height: 0.05, depth: 0.2 }, scene);
        pistolReceiver.position = new Vector3(0, 0.025, 0.05);
        pistolReceiver.material = gunmetal;
        pistolReceiver.parent = pistolRoot;

        pistolRoot.getChildMeshes().forEach((m: any) => {
            m.alwaysSelectAsActiveMesh = true;
            m.isPickable = false;
        });

        pistolRoot.setEnabled(false); 

        const aimPoint = new TransformNode("AimPoint", scene);
        aimPoint.parent = akRoot;
        aimPoint.position = new Vector3(0, 0.08, 0.1); 

        const muzzlePoint = new Mesh("muzzle", scene);
        muzzlePoint.position = new Vector3(0, 0.08, 0.45);
        muzzlePoint.parent = swayRoot;

        const flash = createMuzzleFlash(muzzlePoint, scene);
        const shellPoint = new Mesh("shellPoint", scene);
        shellPoint.parent = swayRoot;
        const shellEjector = createShellEjector(shellPoint, scene);

        WeaponStateComponent.activeWeaponIndex[playerEid] = 0;
        WeaponStateComponent.currentAmmo[playerEid] = WEAPON_CONFIGS[0].magSize;
        WeaponStateComponent.currentSpread[playerEid] = WEAPON_CONFIGS[0].baseSpread;
        WeaponStateComponent.isReloading[playerEid] = 0;
        WeaponStateComponent.reloadTimer[playerEid] = 0;
        WeaponStateComponent.lastFireTime[playerEid] = 0;
        WeaponStateComponent.adsProgress[playerEid] = 0;

        window.dispatchEvent(new CustomEvent('ammo-update', { detail: { ammo: WEAPON_CONFIGS[0].magSize, max: WEAPON_CONFIGS[0].magSize } }));

        const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        
        const crosshairH = new Rectangle();
        crosshairH.width = "10px";
        crosshairH.height = "2px";
        crosshairH.color = "white";
        crosshairH.background = "white";
        advancedTexture.addControl(crosshairH);

        const crosshairV = new Rectangle();
        crosshairV.width = "2px";
        crosshairV.height = "10px";
        crosshairV.color = "white";
        crosshairV.background = "white";
        advancedTexture.addControl(crosshairV);

        if (networkManager) {
            networkManager.onHitConfirmed = () => {
                crosshairH.color = "rgba(255, 0, 0, 0.7)";
                crosshairV.color = "rgba(255, 0, 0, 0.7)";
                setTimeout(() => { crosshairH.color = "white"; crosshairV.color = "white"; }, 100);
            };
            networkManager.onKillConfirmed = () => {
                crosshairH.color = "red";
                crosshairV.color = "red";
                setTimeout(() => { crosshairH.color = "white"; crosshairV.color = "white"; }, 250); 
            };
        }



        
    const ammoText = document.getElementById("ammoText");
    window.addEventListener('ammo-update', (e) => {
        if (ammoText) ammoText.innerText = `AMMO: ${(e as any).detail.ammo} / ${(e as any).detail.max}`;
    });


        // @ts-ignore
        const DEG2RAD = Math.PI / 180;

        
    // ADD OBJECTS TO ECS VIEWMAPS
    entitySwayRoots.set(playerEid, swayRoot);
    entityWeaponSocketOffsets.set(playerEid, weaponSocketOffset);
    entityAKRoots.set(playerEid, akRoot);
    entityPistolRoots.set(playerEid, pistolRoot);
    entityAimPoints.set(playerEid, aimPoint);
    entityFlashParticles.set(playerEid, flash);
    entityShellParticles.set(playerEid, shellEjector);
    
    // Initialize ECS State
    WeaponStateComponent.activeWeaponIndex[playerEid] = 0; // AK47
    WeaponStateComponent.currentAmmo[playerEid] = WEAPON_CONFIGS[0].magSize;
    WeaponStateComponent.isReloading[playerEid] = 0;
    WeaponStateComponent.currentSpread[playerEid] = WEAPON_CONFIGS[0].baseSpread;
    WeaponStateComponent.adsProgress[playerEid] = 0;

};
