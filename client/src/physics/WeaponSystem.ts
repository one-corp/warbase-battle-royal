import {
    Scene,
    MeshBuilder,
    Color3,
    Vector3,
    TransformNode,
    ParticleSystem,
    Color4,
    AbstractMesh,
    Mesh,
    Scalar,
    SceneLoader,
    StandardMaterial,
    PhysicsMotionType
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle } from "@babylonjs/gui";
import { throwGrenade } from './GrenadeSystem';
import type { NetworkManager } from "../network/NetworkManager";
import { initDecalSystem, spawnDecal } from "../ecs/systems/DecalSystem";
import { initTracerSystem, spawnTracer, updateTracers } from "../ecs/systems/TracerSystem";
import { initImpactSystem, spawnImpact } from "../ecs/systems/ImpactSystem";
import { entityCameras, entityPhysicsBodies } from "../ecs/ViewMaps";
import { InputComponent, PlayerComponent } from "../ecs/Components";

interface WeaponConfig {
    id: string;
    damage: number;
    headshotMultiplier: number;
    fireRate: number;
    magSize: number;
    reloadTime: number;
    baseSpread: number;
    bloomPerShot: number;
    maxSpread: number;
    bloomRecovery: number;
    recoilVertical: number;
    recoilHorizontal: number;
    recoilRecovery: number;
    adsFOV: number;
    adsTime: number;
    adsSpreadMult: number;
    adsRecoilMult: number;
    hipPosition: Vector3;
    adsPosition: Vector3;
}

const AK47: WeaponConfig = {
    id: 'ak47',
    damage: 34,
    headshotMultiplier: 2.5,
    fireRate: 600,
    magSize: 30,
    reloadTime: 2.5,
    baseSpread: 1.5,
    bloomPerShot: 0.4,
    maxSpread: 5.0,
    bloomRecovery: 8.0,
    recoilVertical: 0.05,
    recoilHorizontal: 0.02,
    recoilRecovery: 6.0,
    adsFOV: 55,
    adsTime: 0.2,
    adsSpreadMult: 0.4,
    adsRecoilMult: 0.7,
    hipPosition: new Vector3(0.3, -0.3, 0.6),
    adsPosition: new Vector3(0.0, -0.15, 0.4),
};

const PISTOL: WeaponConfig = {
    id: 'pistol',
    damage: 25,
    headshotMultiplier: 3.0,
    fireRate: 400,
    magSize: 12,
    reloadTime: 1.5,
    baseSpread: 1.0,
    bloomPerShot: 0.8,
    maxSpread: 6.0,
    bloomRecovery: 12.0,
    recoilVertical: 0.08,
    recoilHorizontal: 0.01,
    recoilRecovery: 10.0,
    adsFOV: 65,
    adsTime: 0.12,
    adsSpreadMult: 0.2,
    adsRecoilMult: 0.5,
    hipPosition: new Vector3(0.2, -0.2, 0.5),
    adsPosition: new Vector3(0.0, -0.1, 0.35),
};

class RecoilController {
    public offsetX = 0;
    public offsetY = 0;
    
    applyShot(config: WeaponConfig, isADS: boolean) {
        const mult = isADS ? config.adsRecoilMult : 1.0;
        this.offsetY -= config.recoilVertical * mult;
        this.offsetX += (Math.random() - 0.5) * 2 * config.recoilHorizontal * mult;
    }
    
    update(dt: number, config: WeaponConfig) {
        this.offsetX = Scalar.Lerp(this.offsetX, 0, config.recoilRecovery * dt);
        this.offsetY = Scalar.Lerp(this.offsetY, 0, config.recoilRecovery * dt);
    }
}

export class WeaponSystem {
    private activeConfig: WeaponConfig = AK47;
    private currentAmmo = this.activeConfig.magSize;
    private lastFireTime = 0;
    private isReloading = false;
    private reloadTimer = 0;
    private currentSpread = this.activeConfig.baseSpread;
    private recoil = new RecoilController();
    private adsProgress = 0;
    private kickbackZ = 0;
    private kickbackRotX = 0;
    private lastGrenadeTime = 0;
    private justPressed1 = false;
    private justPressed2 = false;
    private swayX = 0;
    private swayY = 0;
    private walkBobTimer = 0;

    private currentAnim = "idle";
    private playAnim: (name: string, forceRestart?: boolean) => void = () => {};

    private scene: Scene;
    private playerEid: number;
    private networkManager?: NetworkManager;

    constructor(
        scene: Scene, 
        playerEid: number, 
        networkManager?: NetworkManager
    ) {
        this.scene = scene;
        this.playerEid = playerEid;
        this.networkManager = networkManager;
    }

    public async init() {
        initDecalSystem(this.scene);
        initTracerSystem(this.scene);
        initImpactSystem(this.scene);
        
        const camera = entityCameras.get(this.playerEid);
        if (!camera) throw new Error("Player camera not found in ECS view map");
        
        const oldRoot = this.scene.getNodeByName("swayRoot");
        if (oldRoot) oldRoot.dispose();
        
        const swayRoot = new TransformNode("swayRoot", this.scene);
        swayRoot.parent = camera;

        const container = await SceneLoader.LoadAssetContainerAsync("./models/", `AnimatedSoldier.glb?v=${Date.now()}`, this.scene);
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

        this.playAnim = (name: string, forceRestart: boolean = false) => {
            if (this.currentAnim === name && !forceRestart) return;
            
            const targetAnim = animGroups.find((ag: any) => {
                const agName = ag.name.toLowerCase();
                if (name === "firing") return agName.includes("firing") && !agName.includes("walk");
                return agName.includes(name);
            });
            
            const currentAg = animGroups.find((ag: any) => ag.name.toLowerCase().includes(this.currentAnim));
            if (currentAg) currentAg.stop();

            if (targetAnim) {
                targetAnim.start(true, 1.0, targetAnim.from, targetAnim.to, false);
                this.currentAnim = name;
            } else if (name === "idle") {
                const fallback = animGroups.find((ag: any) => ag.name.toLowerCase().includes("tpose"));
                if (fallback) {
                    fallback.start(true, 1.0, fallback.from, fallback.to, false);
                    this.currentAnim = "idle";
                }
            }
        };

        this.playAnim("idle");

        const weaponSocketRoot = new TransformNode("WeaponSocketRoot", this.scene);
        const weaponSocketOffset = new TransformNode("WeaponSocketOffset", this.scene);
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

        const gunmetal = new StandardMaterial("gunmetal", this.scene);
        gunmetal.diffuseColor = new Color3(0.2, 0.2, 0.2);
        gunmetal.specularColor = new Color3(0.5, 0.5, 0.5);
        
        const matteBlack = new StandardMaterial("matteBlack", this.scene);
        matteBlack.diffuseColor = new Color3(0.05, 0.05, 0.05);

        const akRoot = new TransformNode("ak47", this.scene);
        akRoot.parent = weaponSocketOffset;
        
        const akGrip = MeshBuilder.CreateBox("akGrip", { width: 0.04, height: 0.12, depth: 0.06 }, this.scene);
        akGrip.position = new Vector3(0, -0.06, 0);
        akGrip.rotation.x = Math.PI / 8;
        akGrip.material = matteBlack;
        akGrip.parent = akRoot;
        
        const akReceiver = MeshBuilder.CreateBox("akReceiver", { width: 0.05, height: 0.08, depth: 0.3 }, this.scene);
        akReceiver.position = new Vector3(0, 0.04, 0.1);
        akReceiver.material = gunmetal;
        akReceiver.parent = akRoot;
        
        const akBarrel = MeshBuilder.CreateCylinder("akBarrel", { diameter: 0.02, height: 0.4 }, this.scene);
        akBarrel.rotation.x = Math.PI / 2;
        akBarrel.position = new Vector3(0, 0.06, 0.45);
        akBarrel.material = gunmetal;
        akBarrel.parent = akRoot;

        const akMag = MeshBuilder.CreateBox("akMag", { width: 0.04, height: 0.15, depth: 0.08 }, this.scene);
        akMag.rotation.x = -Math.PI / 8;
        akMag.position = new Vector3(0, -0.05, 0.2);
        akMag.material = matteBlack;
        akMag.parent = akRoot;

        const akStock = MeshBuilder.CreateBox("akStock", { width: 0.04, height: 0.08, depth: 0.2 }, this.scene);
        akStock.position = new Vector3(0, 0.02, -0.15);
        akStock.material = gunmetal;
        akStock.parent = akRoot;

        akRoot.getChildMeshes().forEach((m: any) => {
            m.alwaysSelectAsActiveMesh = true;
            m.isPickable = false;
        });

        const pistolRoot = new TransformNode("pistol", this.scene);
        pistolRoot.parent = weaponSocketOffset;
        
        const pistolGrip = MeshBuilder.CreateBox("pistolGrip", { width: 0.03, height: 0.1, depth: 0.05 }, this.scene);
        pistolGrip.position = new Vector3(0, -0.05, 0);
        pistolGrip.rotation.x = Math.PI / 16;
        pistolGrip.material = matteBlack;
        pistolGrip.parent = pistolRoot;
        
        const pistolReceiver = MeshBuilder.CreateBox("pistolReceiver", { width: 0.04, height: 0.05, depth: 0.2 }, this.scene);
        pistolReceiver.position = new Vector3(0, 0.025, 0.05);
        pistolReceiver.material = gunmetal;
        pistolReceiver.parent = pistolRoot;

        pistolRoot.getChildMeshes().forEach((m: any) => {
            m.alwaysSelectAsActiveMesh = true;
            m.isPickable = false;
        });

        pistolRoot.setEnabled(false); 

        const aimPoint = new TransformNode("AimPoint", this.scene);
        aimPoint.parent = akRoot;
        aimPoint.position = new Vector3(0, 0.08, 0.1); 

        const muzzlePoint = new Mesh("muzzle", this.scene);
        muzzlePoint.parent = swayRoot;

        const flash = this.createMuzzleFlash(muzzlePoint);
        const shellPoint = new Mesh("shellPoint", this.scene);
        shellPoint.parent = swayRoot;
        const shellEjector = this.createShellEjector(shellPoint);

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

        if (this.networkManager) {
            this.networkManager.onHitConfirmed = () => {
                crosshairH.color = "rgba(255, 0, 0, 0.7)";
                crosshairV.color = "rgba(255, 0, 0, 0.7)";
                setTimeout(() => { crosshairH.color = "white"; crosshairV.color = "white"; }, 100);
            };
            this.networkManager.onKillConfirmed = () => {
                crosshairH.color = "red";
                crosshairV.color = "red";
                setTimeout(() => { crosshairH.color = "white"; crosshairV.color = "white"; }, 250); 
            };
        }



        const ammoText = document.getElementById("ammoText");
        const updateUI = () => { if (ammoText) ammoText.innerText = `${this.activeConfig.id.toUpperCase()}: ${this.currentAmmo} / --`; };
        updateUI();

        const DEG2RAD = Math.PI / 180;

        this.scene.onBeforeRenderObservable.add(() => {
            const dt = this.scene.getEngine().getDeltaTime() / 1000;
            updateTracers(dt);
            
            const eid = this.playerEid;
            const input = {
                weapon1: InputComponent.weapon1[eid] === 1,
                weapon2: InputComponent.weapon2[eid] === 1,
                fire: InputComponent.fire[eid] === 1,
                ads: InputComponent.ads[eid] === 1,
                reload: InputComponent.reload[eid] === 1,
                grenade: InputComponent.grenade[eid] === 1,
                forward: InputComponent.forward[eid] === 1,
                backward: InputComponent.backward[eid] === 1,
                left: InputComponent.left[eid] === 1,
                right: InputComponent.right[eid] === 1,
                sprint: InputComponent.sprint[eid] === 1,
                mouseDeltaX: InputComponent.mouseDeltaX[eid],
                mouseDeltaY: InputComponent.mouseDeltaY[eid]
            };
            const playerState = {
                isSprinting: PlayerComponent.isSprinting[eid] === 1,
                isGrounded: PlayerComponent.isGrounded[eid] === 1
            };
            
            if (input.weapon1 && !this.justPressed1 && this.activeConfig.id !== 'ak47') {
                this.activeConfig = AK47;
                this.currentAmmo = this.activeConfig.magSize;
                pistolRoot.setEnabled(false);
                akRoot.setEnabled(true);
                aimPoint.parent = akRoot;
                aimPoint.position = new Vector3(0, 0.08, 0.1);
                this.isReloading = false;
                if (this.networkManager) this.networkManager.sendSwitchWeapon('ak47');
            }
            this.justPressed1 = input.weapon1;

            if (input.weapon2 && !this.justPressed2 && this.activeConfig.id !== 'pistol') {
                this.activeConfig = PISTOL;
                this.currentAmmo = this.activeConfig.magSize;
                akRoot.setEnabled(false);
                pistolRoot.setEnabled(true);
                updateUI();
                this.isReloading = false;
                if (this.networkManager) this.networkManager.sendSwitchWeapon('pistol');
            }
            this.justPressed2 = input.weapon2;

            if (input.grenade && performance.now() - this.lastGrenadeTime > 2000) {
                this.lastGrenadeTime = performance.now();
                throwGrenade(this.scene, camera);
            }
            
            const isADS = input.ads && !this.isReloading;
            this.adsProgress = Scalar.Lerp(this.adsProgress, isADS ? 1 : 0, (1 / this.activeConfig.adsTime) * dt);
            
            if ((window as any).debugKeys) {
                const keys = (window as any).debugKeys;
                if (keys['u']) socketPos.x -= 0.01 * dt;
                if (keys['i']) socketPos.x += 0.01 * dt;
                if (keys['o']) socketPos.y -= 0.01 * dt;
                if (keys['p']) socketPos.y += 0.01 * dt;
                if (keys['k']) socketPos.z -= 0.01 * dt;
                if (keys['l']) socketPos.z += 0.01 * dt;
                
                if (keys['n']) socketRot.x -= 1.0 * dt;
                if (keys['m']) socketRot.x += 1.0 * dt;
                if (keys['1']) socketRot.y -= 1.0 * dt;
                if (keys['2']) socketRot.y += 1.0 * dt;
                if (keys['3']) socketRot.z -= 1.0 * dt;
                if (keys['4']) socketRot.z += 1.0 * dt;

                let activeRoot = this.activeConfig.id === 'ak47' ? akRoot : pistolRoot;
                if (keys['5']) {
                    const s = activeRoot.scaling.x - 0.5 * dt;
                    activeRoot.scaling = new Vector3(s, s, s);
                }
                if (keys['6']) {
                    const s = activeRoot.scaling.x + 0.5 * dt;
                    activeRoot.scaling = new Vector3(s, s, s);
                }

                if (keys['7']) aimPoint.position.y -= 0.5 * dt;
                if (keys['8']) aimPoint.position.y += 0.5 * dt;
                
                weaponSocketOffset.position.copyFrom(socketPos);
                weaponSocketOffset.rotation.copyFrom(socketRot);
            }
            


            let reloadOffset = new Vector3(0, 0, 0);
            let reloadRotX = 0;

            if (this.isReloading) {
                this.reloadTimer += dt;
                const progress = this.reloadTimer / this.activeConfig.reloadTime;
                
                if (progress < 0.2) {
                    const t = progress / 0.2;
                    reloadOffset.y = Scalar.Lerp(0, -0.4, t);
                    reloadRotX = Scalar.Lerp(0, Math.PI / 4, t);
                } else if (progress < 0.8) {
                    reloadOffset.y = -0.4;
                    reloadRotX = Math.PI / 4;
                } else {
                    const t = (progress - 0.8) / 0.2;
                    reloadOffset.y = Scalar.Lerp(-0.4, 0, t);
                    reloadRotX = Scalar.Lerp(Math.PI / 4, 0, t);
                }

                if (progress >= 1.0) {
                    this.currentAmmo = this.activeConfig.magSize;
                    this.isReloading = false;
                    updateUI();
                }
            }

            const basePos = Vector3.Lerp(Vector3.Zero(), this.activeConfig.adsPosition, this.adsProgress);
            swayRoot.position = basePos.add(reloadOffset);
            swayRoot.rotation.x = reloadRotX;

            const canFire = this.currentAmmo > 0 && !this.isReloading;
            const wantsToFire = input.fire;
            const fireInterval = 60000 / this.activeConfig.fireRate;

            if (wantsToFire && canFire && performance.now() - this.lastFireTime >= fireInterval) {
                this.lastFireTime = performance.now();
                this.currentAmmo--;
                updateUI();
                
                if (this.networkManager) this.networkManager.sendFire();

                this.recoil.applyShot(this.activeConfig, isADS);
                this.currentSpread = Math.min(this.currentSpread + this.activeConfig.bloomPerShot, this.activeConfig.maxSpread);
                
                this.kickbackZ = isADS ? -0.02 : -0.05;
                this.kickbackRotX = isADS ? -0.02 : -0.08; 
                
                flash.manualEmitCount = 5;
                flash.start();
                setTimeout(() => flash.stop(), 50);

                const spreadAngle = this.currentSpread * DEG2RAD * (isADS ? this.activeConfig.adsSpreadMult : 1.0);
                const rot = Math.random() * Math.PI * 2;
                const forward = camera.getDirection(Vector3.Forward());
                const right = camera.getDirection(Vector3.Right());
                const up = camera.getDirection(Vector3.Up());
                
                const isMoving = input.forward || input.backward || input.left || input.right;
                if (isMoving && playerState.isGrounded) {
                    this.playAnim("firing walk", true);
                } else {
                    this.playAnim("firing", true);
                }
                
                const spreadDir = forward
                    .add(right.scale(Math.sin(spreadAngle) * Math.cos(rot)))
                    .add(up.scale(Math.sin(spreadAngle) * Math.sin(rot)))
                    .normalize();

                const endPoint = camera.globalPosition.add(spreadDir.scale(300)); 
                let hitPoint = endPoint;
                
                const query: any = { shouldHitTriggers: true };
                const localBody = entityPhysicsBodies.get(this.playerEid);
                if (localBody) {
                    query.ignoreBody = localBody;
                }

                const physResult = this.scene.getPhysicsEngine()?.raycast(camera.globalPosition, endPoint, query);

                if (physResult && physResult.hasHit && physResult.body && physResult.body.transformNode) {
                    hitPoint = physResult.hitPointWorld;
                    const hitMesh = physResult.body.transformNode;

                    if (hitMesh.physicsBody && hitMesh.physicsBody.getMotionType() === PhysicsMotionType.DYNAMIC) {
                        hitMesh.physicsBody.applyImpulse(spreadDir.scale(10), hitPoint);
                    }
                    
                    if (hitMesh.metadata && hitMesh.metadata.isHitbox && hitMesh.metadata.playerId && hitMesh.metadata.playerId !== this.networkManager?.username) {
                        if (this.networkManager) {
                            const targetId = hitMesh.metadata.playerId;
                            const mult = hitMesh.metadata.multiplier || 1.0;
                            const finalDamage = Math.round(this.activeConfig.damage * mult);
                            this.networkManager.sendHit(targetId, finalDamage);
                        }
                    } else if (!hitMesh.metadata?.playerId) {
                        const normal = physResult.hitNormalWorld;
                        const decalPos = hitPoint.add(normal.scale(0.02));
                        
                        // We need a dummy quaternion for lookAt, or we just pass a simple rotation
                        // Wait, spawnDecal expects rx, ry, rz, rw. 
                        // For now, let's just update the mesh directly inside spawnDecal. I'll modify spawnDecal.
                        spawnDecal(decalPos, decalPos.add(normal));
                        
                        // Spawn physical 3D sparks bouncing off the wall!
                        spawnImpact(hitPoint, normal);
                    }
                }

                const startPoint = camera.globalPosition.add(new Vector3(0, -0.2, 0));
                spawnTracer(startPoint, hitPoint);

                shellEjector.manualEmitCount = 1;
                shellEjector.start();
            }

            if ((input.reload || (wantsToFire && this.currentAmmo === 0)) && !this.isReloading && this.currentAmmo < this.activeConfig.magSize) {
                this.isReloading = true;
                this.reloadTimer = 0;
                if (this.networkManager) this.networkManager.sendReload();
            }

            this.currentSpread = Math.max(this.activeConfig.baseSpread, this.currentSpread - this.activeConfig.bloomRecovery * dt);
            this.recoil.update(dt, this.activeConfig);
            
            camera.rotation.x += this.recoil.offsetY;
            camera.rotation.y += this.recoil.offsetX;

            const swayTargetX = -input.mouseDeltaX * 0.001;
            const swayTargetY = -input.mouseDeltaY * 0.001;
            this.swayX = Scalar.Lerp(this.swayX, swayTargetX, 10 * dt);
            this.swayY = Scalar.Lerp(this.swayY, swayTargetY, 10 * dt);
            
            let bobX = 0;
            let bobY = 0;
            const isMoving = input.forward || input.backward || input.left || input.right;
            
            if (isMoving && !this.isReloading) {
                const bobSpeed = input.sprint ? 15 : 10;
                const bobAmp = input.sprint ? 0.012 : 0.01;
                this.walkBobTimer += dt * bobSpeed;
                bobX = Math.sin(this.walkBobTimer) * bobAmp;
                bobY = Math.abs(Math.cos(this.walkBobTimer)) * bobAmp; 
            } else {
                this.walkBobTimer = 0;
                const t = performance.now() * 0.001;
                bobY = Math.sin(t * 1.5) * 0.003;
            }

            const desiredWorldPos = camera.globalPosition.add(camera.getDirection(Vector3.Forward()).scale(0.3));
            const currentAimWorldPos = aimPoint.getAbsolutePosition();
            const deltaWorldPos = desiredWorldPos.subtract(currentAimWorldPos);
            const invertedCameraMatrix = camera.getWorldMatrix().clone().invert();
            const localDelta = Vector3.TransformNormal(deltaWorldPos, invertedCameraMatrix);
            const mathematicalADSPos = swayRoot.position.add(localDelta);

            const hipfirePos = basePos.add(reloadOffset);
            const currentTargetPos = Vector3.Lerp(hipfirePos, mathematicalADSPos, this.adsProgress);
            
            const adsSwayMult = 1.0 - (this.adsProgress * 0.8); 
            swayRoot.rotation.y = this.swayX * adsSwayMult;
            swayRoot.rotation.x = reloadRotX + (this.swayY * adsSwayMult) + this.kickbackRotX; 
            
            swayRoot.position.x = currentTargetPos.x + (bobX * adsSwayMult); 
            swayRoot.position.y = currentTargetPos.y + (bobY * adsSwayMult);
            swayRoot.position.z = currentTargetPos.z + this.kickbackZ;
            
            this.kickbackZ = Scalar.Lerp(this.kickbackZ, 0, 15 * dt); 
            this.kickbackRotX = Scalar.Lerp(this.kickbackRotX, 0, 15 * dt); 

            const isRecentFire = performance.now() - this.lastFireTime < 250;

            if (isRecentFire) {
                // Keep playing fire anim
            } else if (!playerState.isGrounded) {
                this.playAnim("jump");
            } else if (isMoving) {
                this.playAnim("run");
            } else {
                this.playAnim("idle");
            }
        });
    }


    private createMuzzleFlash(parent: AbstractMesh): ParticleSystem {
        const ps = new ParticleSystem("muzzleFlash", 15, this.scene);
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
    }

    private createShellEjector(parent: AbstractMesh): ParticleSystem {
        const ps = new ParticleSystem("shells", 10, this.scene);
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
    }
}
