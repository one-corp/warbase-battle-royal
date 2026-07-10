import {
    Scene,
    UniversalCamera,
    MeshBuilder,
    Color3,
    Vector3,
    Ray,
    TransformNode,
    ParticleSystem,
    Color4,
    AbstractMesh,
    Mesh,
    Scalar,
    SceneLoader
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock } from "@babylonjs/gui";
import { input, playerState } from './PlayerController';
import { throwGrenade } from './GrenadeSystem';

interface WeaponConfig {
    id: string;
    damage: number;
    headshotMultiplier: number;
    fireRate: number;          // RPM
    magSize: number;
    reloadTime: number;        // seconds
    
    baseSpread: number;        // degrees
    bloomPerShot: number;      
    maxSpread: number;         
    bloomRecovery: number;     // degrees/second
    
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
    headshotMultiplier: 3.0, // High reward for headshots
    fireRate: 400, // Semi-auto usually, but capped RPM
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
    adsTime: 0.12, // Faster ADS
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
        this.offsetY -= config.recoilVertical * mult; // negative pitches camera UP
        this.offsetX += (Math.random() - 0.5) * 2 * config.recoilHorizontal * mult;
    }
    
    update(dt: number, config: WeaponConfig) {
        this.offsetX = Scalar.Lerp(this.offsetX, 0, config.recoilRecovery * dt);
        this.offsetY = Scalar.Lerp(this.offsetY, 0, config.recoilRecovery * dt);
    }
}



function createMuzzleFlash(scene: Scene, parent: AbstractMesh): ParticleSystem {
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
}

function createShellEjector(scene: Scene, parent: AbstractMesh): ParticleSystem {
    const ps = new ParticleSystem("shells", 10, scene);
    ps.particleTexture = null as any; 
    ps.emitter = parent;
    ps.emitRate = 0;
    ps.minLifeTime = 1.0;
    ps.maxLifeTime = 1.5;
    ps.minSize = 0.03;
    ps.maxSize = 0.04;
    ps.color1 = new Color4(0.8, 0.7, 0.2, 1.0); // Brass
    ps.color2 = new Color4(0.7, 0.6, 0.1, 1.0);
    ps.colorDead = new Color4(0.5, 0.4, 0.1, 0.0);
    
    ps.direction1 = new Vector3(1, 1, 0);
    ps.direction2 = new Vector3(2, 2, 0.5);
    ps.gravity = new Vector3(0, -9.81, 0);
    return ps;
}

import type { NetworkManager } from "./NetworkManager";

let playAnim: (name: string) => void = () => {};

export async function setupWeaponSystem(scene: Scene, camera: UniversalCamera, networkManager?: NetworkManager) {
    let activeConfig = AK47;
    // Clean up old weapons for HMR
    const oldRoot = scene.getNodeByName("swayRoot");
    if (oldRoot) {
        oldRoot.dispose();
    }
    
    // Create a sway root to apply sway/bob independent of recoil
    const swayRoot = new TransformNode("swayRoot", scene);
    swayRoot.parent = camera;

    // Load Soldier model for viewmodel
    const container = await SceneLoader.LoadAssetContainerAsync("./models/", `AnimatedSoldier.glb?v=${Date.now()}`, scene);
    const entries = container.instantiateModelsToScene();
    const viewmodelRoot = entries.rootNodes[0] as TransformNode;
    viewmodelRoot.parent = swayRoot;
    
    // Position body so camera is in front of the face, and face forward
    viewmodelRoot.position = new Vector3(0, -1.6, -0.4); 
    viewmodelRoot.rotation = new Vector3(0, 0, 0); 
    

    
    viewmodelRoot.getChildMeshes().forEach((m: any) => {
        m.alwaysSelectAsActiveMesh = true;
        m.isPickable = false;
    });

    let currentAnim = "idle";
    const animGroups = entries.animationGroups;
    let baseAnimGroups: any[] = [];
    let firingAnimGroup: any = null;
    let currentFiringWeight = 0;
    
    // Separate Additive vs Base animations
    animGroups.forEach((ag: any) => {
        console.log("Loaded Animation:", ag.name); // Debug log
        if (ag.name.toLowerCase().includes("firing")) {
            ag.isAdditive = true;
            firingAnimGroup = ag;
            ag.start(true);
            ag.setWeightForAllAnimatables(0);
        } else {
            baseAnimGroups.push(ag);
            if (ag.targetedAnimations) {
                ag.targetedAnimations.forEach((ta: any) => {
                    ta.animation.enableBlending = true;
                    ta.animation.blendingSpeed = 0.1; 
                });
            }
        }
    });

    playAnim = (name: string) => {
        if (currentAnim === name) return;
        const targetAnim = baseAnimGroups.find((ag: any) => ag.name.toLowerCase().includes(name));
        if (targetAnim) {
            baseAnimGroups.forEach((ag: any) => ag.stop());
            targetAnim.start(true);
            currentAnim = name;
        } else if (name === "idle") {
            const fallback = baseAnimGroups.find((ag: any) => ag.name.toLowerCase().includes("tpose"));
            if (fallback) {
                baseAnimGroups.forEach((ag: any) => ag.stop());
                fallback.start(true);
                currentAnim = "idle";
            }
        }
    };

    playAnim("idle");

    if (entries.skeletons && entries.skeletons.length > 0) {
        // Unused block, can remain empty
    }

    // Load AK47
    const akContainer = await SceneLoader.LoadAssetContainerAsync("./models/", "ak47.glb", scene);
    const akEntries = akContainer.instantiateModelsToScene();
    const akRoot = akEntries.rootNodes[0] as TransformNode;
    
    // Convert PBR materials to Standard to guarantee lighting visibility, and force active
    akRoot.getChildMeshes().forEach((m: any) => {
        m.alwaysSelectAsActiveMesh = true;
        m.isPickable = false;
        if (m.material && m.material.getClassName() === "PBRMaterial") {
            m.material.unlit = true;
        }
    });

    // Create the Industry Standard AimPoint (Sight Node)
    // This is placed roughly where the iron sights of the AK47 are.
    const aimPoint = new TransformNode("AimPoint", scene);
    aimPoint.parent = akRoot;
    // Tweak this vector to match the exact physical iron sight peak of your 3D model
    aimPoint.position = new Vector3(0, 0.15, -0.1);
    
    
    // Mixamo hand bones point down the Y-axis. The gun models usually point down Z-axis.
    let baseGunRot = new Vector3(Math.PI / 2, 0, 0); 
    let baseGunPos = new Vector3(0, 0, 0);

    // Use Babylon's native attachToBone instead of setParent to fix weird Mixamo scaling/rotations
    let rightHandBone: any = null;
    if (entries.skeletons && entries.skeletons.length > 0) {
        entries.skeletons[0].bones.forEach((bone: any) => {
            if (bone.name.includes("RightHand")) {
                rightHandBone = bone;
            }
        });
    }

    // Attach to hand if found, otherwise fallback to camera sway root
    if (rightHandBone) {
        akRoot.attachToBone(rightHandBone, viewmodelRoot);
        akRoot.position = baseGunPos; 
        akRoot.rotation = baseGunRot; 
    } else {
        akRoot.parent = swayRoot;
        akRoot.position = new Vector3(0.15, -0.2, 0.4);
        akRoot.rotation = new Vector3(Math.PI / 2, -Math.PI / 2, 0);
    }
    akRoot.scaling = new Vector3(0.3, 0.3, 0.3);

    // Load Pistol
    const pistolContainer = await SceneLoader.LoadAssetContainerAsync("./models/", "pistol.glb", scene);
    const pistolEntries = pistolContainer.instantiateModelsToScene();
    const pistolRoot = pistolEntries.rootNodes[0] as TransformNode;
    
    pistolRoot.getChildMeshes().forEach((m: any) => {
        m.alwaysSelectAsActiveMesh = true;
        if (m.material && m.material.getClassName() === "PBRMaterial") {
            m.material.unlit = true;
        }
    });
    
    pistolRoot.parent = swayRoot;
    pistolRoot.scaling = new Vector3(0.3, 0.3, 0.3);
    pistolRoot.position = new Vector3(0.15, -0.2, 0.4);
    pistolRoot.rotation = new Vector3(Math.PI / 2, -Math.PI / 2, 0);

    pistolRoot.setEnabled(false); // Default to AK47

    // Muzzle Points (estimated relative to the weapon roots)
    const muzzlePoint = new Mesh("muzzle", scene);
    muzzlePoint.parent = swayRoot; // We'll just cast from center of screen for simplicity to avoid bone transform complexity

    const flash = createMuzzleFlash(scene, muzzlePoint);
    const shellPoint = new Mesh("shellPoint", scene);
    shellPoint.parent = swayRoot;
    const shellEjector = createShellEjector(scene, shellPoint);

    // Debug GUI for perfectly aligning the gun to the center of the screen
    const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
    
    // Hipfire Crosshair
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

    const debugPanel = new Rectangle("debugPanel");
    debugPanel.width = "350px";
    debugPanel.height = "250px";
    debugPanel.horizontalAlignment = 0; // Left
    debugPanel.verticalAlignment = 1; // Bottom
    debugPanel.background = "rgba(0,0,0,0.5)";
    debugPanel.color = "white";
    advancedTexture.addControl(debugPanel);

    const debugText = new TextBlock("debugText");
    debugText.text = "HAND OFFSET DEBUG\nPos X/Y/Z: U/I, O/P, K/L\nRot X/Y/Z: N/M, 1/2, 3/4\nSight Node Y/Z: 5/6, 7/8";
    debugText.textWrapping = true;
    debugText.fontSize = 14;
    debugPanel.addControl(debugText);

    // State
    let currentAmmo = activeConfig.magSize;
    let lastFireTime = 0;
    let isReloading = false;
    let reloadTimer = 0;
    let currentSpread = activeConfig.baseSpread;
    const recoil = new RecoilController();
    let adsProgress = 0;
    let kickbackZ = 0; // Procedural weapon kickback
    
    // Inventory State
    let lastGrenadeTime = 0;
    let justPressed1 = false;
    let justPressed2 = false;

    let swayX = 0;
    let swayY = 0;
    let walkBobTimer = 0;

    const ammoText = document.getElementById("ammoText");
    const updateUI = () => { if (ammoText) ammoText.innerText = `${activeConfig.id.toUpperCase()}: ${currentAmmo} / --`; };
    updateUI();

    const DEG2RAD = Math.PI / 180;

    scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000;
        
        // Weapon Switching
        if (input.weapon1 && !justPressed1 && activeConfig.id !== 'ak47') {
            activeConfig = AK47;
            currentAmmo = activeConfig.magSize;
            pistolRoot.setEnabled(false);
            akRoot.setEnabled(true);
            updateUI();
            isReloading = false;
        }
        justPressed1 = input.weapon1;

        if (input.weapon2 && !justPressed2 && activeConfig.id !== 'pistol') {
            activeConfig = PISTOL;
            currentAmmo = activeConfig.magSize;
            akRoot.setEnabled(false);
            pistolRoot.setEnabled(true);
            updateUI();
            isReloading = false;
        }
        justPressed2 = input.weapon2;

        // Grenade Throwing
        if (input.grenade && performance.now() - lastGrenadeTime > 2000) {
            lastGrenadeTime = performance.now();
            throwGrenade(scene, camera);
        }
        
        // ADS Logic & Scope UI
        const isADS = input.ads && !isReloading;
        adsProgress = Scalar.Lerp(adsProgress, isADS ? 1 : 0, (1 / activeConfig.adsTime) * dt);
        
        // Debug Keyboard controls for tuning ADS position perfectly
        if (input.weapon1) { } // Prevent TS warning
        
        // Debug Keyboard controls for tuning hand offsets and sight nodes perfectly
        if ((window as any).debugKeys) {
            const keys = (window as any).debugKeys;
            
            // Hand Pos
            if (keys['u']) baseGunPos.x -= 0.01 * dt;
            if (keys['i']) baseGunPos.x += 0.01 * dt;
            if (keys['o']) baseGunPos.y -= 0.01 * dt;
            if (keys['p']) baseGunPos.y += 0.01 * dt;
            if (keys['k']) baseGunPos.z -= 0.01 * dt;
            if (keys['l']) baseGunPos.z += 0.01 * dt;
            
            // Hand Rot
            if (keys['n']) baseGunRot.x -= 1.0 * dt;
            if (keys['m']) baseGunRot.x += 1.0 * dt;
            if (keys['1']) baseGunRot.y -= 1.0 * dt;
            if (keys['2']) baseGunRot.y += 1.0 * dt;
            if (keys['3']) baseGunRot.z -= 1.0 * dt;
            if (keys['4']) baseGunRot.z += 1.0 * dt;

            // Sight Node Tweaks
            if (keys['5']) aimPoint.position.y -= 0.01 * dt;
            if (keys['6']) aimPoint.position.y += 0.01 * dt;
            if (keys['7']) aimPoint.position.z -= 0.01 * dt;
            if (keys['8']) aimPoint.position.z += 0.01 * dt;

            if (rightHandBone) {
                akRoot.position.copyFrom(baseGunPos);
                akRoot.rotation.copyFrom(baseGunRot);
            }
        }
        
        if (debugText) {
            debugText.text = `HAND POS: \nX: ${baseGunPos.x.toFixed(3)}\nY: ${baseGunPos.y.toFixed(3)}\nZ: ${baseGunPos.z.toFixed(3)}\nHAND ROT: \nX: ${baseGunRot.x.toFixed(2)}\nY: ${baseGunRot.y.toFixed(2)}\nZ: ${baseGunRot.z.toFixed(2)}\nSIGHT NODE: \nY: ${aimPoint.position.y.toFixed(3)} Z: ${aimPoint.position.z.toFixed(3)}`;
        }

        
        // Reload Animation State Machine
        let reloadOffset = new Vector3(0, 0, 0);
        let reloadRotX = 0;

        if (isReloading) {
            reloadTimer += dt;
            const progress = reloadTimer / activeConfig.reloadTime;
            
            // Procedural Reload Animation
            if (progress < 0.2) {
                // Lower weapon
                const t = progress / 0.2;
                reloadOffset.y = Scalar.Lerp(0, -0.4, t);
                reloadRotX = Scalar.Lerp(0, Math.PI / 4, t);
            } else if (progress < 0.8) {
                // Hold lowered
                reloadOffset.y = -0.4;
                reloadRotX = Math.PI / 4;
            } else {
                // Raise weapon
                const t = (progress - 0.8) / 0.2;
                reloadOffset.y = Scalar.Lerp(-0.4, 0, t);
                reloadRotX = Scalar.Lerp(Math.PI / 4, 0, t);
            }

            if (progress >= 1.0) {
                currentAmmo = activeConfig.magSize;
                isReloading = false;
                updateUI();
            }
        }

        // Apply Position (Hip vs ADS + Reload Offset)
        const basePos = Vector3.Lerp(Vector3.Zero(), activeConfig.adsPosition, adsProgress);
        swayRoot.position = basePos.add(reloadOffset);
        swayRoot.rotation.x = reloadRotX;

        // Firing Logic
        const canFire = currentAmmo > 0 && !isReloading;
        const wantsToFire = input.fire;
        
        const fireInterval = 60000 / activeConfig.fireRate;

        if (wantsToFire && canFire && performance.now() - lastFireTime >= fireInterval) {
            lastFireTime = performance.now();
            currentAmmo--;
            updateUI();
            
            if (networkManager) {
                networkManager.sendFire();
            }

            recoil.applyShot(activeConfig, isADS);
            currentSpread = Math.min(currentSpread + activeConfig.bloomPerShot, activeConfig.maxSpread);
            
            // Procedural Kickback (more violent hipfire, tighter ADS)
            kickbackZ = isADS ? -0.03 : -0.06;
            
            flash.manualEmitCount = 5;
            flash.start();
            setTimeout(() => flash.stop(), 50);

            // Raycast Hitscan
            const spreadAngle = currentSpread * DEG2RAD * (isADS ? activeConfig.adsSpreadMult : 1.0);
            const rot = Math.random() * Math.PI * 2;
            const forward = camera.getDirection(Vector3.Forward());
            const right = camera.getDirection(Vector3.Right());
            const up = camera.getDirection(Vector3.Up());
            
            const spreadDir = forward
                .add(right.scale(Math.sin(spreadAngle) * Math.cos(rot)))
                .add(up.scale(Math.sin(spreadAngle) * Math.sin(rot)))
                .normalize();

            // BUGFIX: Use globalPosition so bullets shoot from the actual camera location, not the world origin!
            const ray = new Ray(camera.globalPosition, spreadDir, 200);
            
            // Hit everything EXCEPT the player capsule
            const hit = scene.pickWithRay(ray, (m) => m.name !== "player" && m.isPickable);
            
            let hitPoint = camera.globalPosition.add(spreadDir.scale(200));

            if (hit?.hit && hit.pickedMesh) {
                hitPoint = hit.pickedPoint!;
                
                // If we hit a physics object, push it
                if (hit.pickedMesh.physicsBody) {
                    hit.pickedMesh.physicsBody.applyImpulse(spreadDir.scale(10), hitPoint);
                }

                // If we hit a remote player
                if (hit.pickedMesh.metadata && hit.pickedMesh.metadata.playerId) {
                    const targetId = hit.pickedMesh.metadata.playerId;
                    if (networkManager) {
                        networkManager.sendHit(targetId, activeConfig.damage);
                    }
                    
                    // Show hitmarker: flash crosshair red
                    crosshairH.color = "red";
                    crosshairV.color = "red";
                    setTimeout(() => {
                        crosshairH.color = "white";
                        crosshairV.color = "white";
                    }, 100);
                } else if (hit.pickedMesh.metadata?.isEnemy) {
                    // If it's a bot, show hit in console
                    console.log("Hit enemy bot! Damage dealt: ", activeConfig.damage);
                }
            }

            // Draw Tracer from camera
            const startPoint = camera.globalPosition.add(new Vector3(0, -0.2, 0));
            const tracer = MeshBuilder.CreateLines("tracer", { points: [startPoint, hitPoint] }, scene);
            tracer.color = new Color3(1.0, 0.9, 0.5); // Bright yellow/white
            setTimeout(() => tracer.dispose(), 50);

            // Eject Shell
            shellEjector.manualEmitCount = 1;
            shellEjector.start();
        }

        // Auto-Reload
        if ((input.reload || (wantsToFire && currentAmmo === 0)) && !isReloading && currentAmmo < activeConfig.magSize) {
            isReloading = true;
            reloadTimer = 0;
        }

        // Spread & Recoil Recovery
        currentSpread = Math.max(activeConfig.baseSpread, currentSpread - activeConfig.bloomRecovery * dt);
        recoil.update(dt, activeConfig);
        
        // Apply recoil to camera
        camera.rotation.x += recoil.offsetY;
        camera.rotation.y += recoil.offsetX;

        // Weapon Sway (Mouse Inertia)
        const swayTargetX = -input.mouseDeltaX * 0.001;
        const swayTargetY = -input.mouseDeltaY * 0.001;
        swayX = Scalar.Lerp(swayX, swayTargetX, 10 * dt);
        swayY = Scalar.Lerp(swayY, swayTargetY, 10 * dt);
        
        // Weapon Bob (Movement)
        let bobX = 0;
        let bobY = 0;
        const isMoving = input.forward || input.backward || input.left || input.right;
        
        if (isMoving && !isReloading) {
            const bobSpeed = input.sprint ? 15 : 10;
            const bobAmp = input.sprint ? 0.02 : 0.01;
            walkBobTimer += dt * bobSpeed;
            bobX = Math.sin(walkBobTimer) * bobAmp;
            bobY = Math.abs(Math.cos(walkBobTimer)) * bobAmp; // absolute value for "bounce"
        } else {
            walkBobTimer = 0;
            // Idle breathing
            const t = performance.now() * 0.001;
            bobY = Math.sin(t * 1.5) * 0.003;
        }

        // Calculate Mathematical ADS Offset to pin AimPoint to Camera Center
        // 1. Where do we want the iron sights to be? (0.3 units in front of the camera lens)
        const desiredWorldPos = camera.globalPosition.add(camera.getDirection(Vector3.Forward()).scale(0.3));
        
        // 2. Where are the iron sights right now?
        const currentAimWorldPos = aimPoint.getAbsolutePosition();
        
        // 3. What is the world space delta required to bridge the gap?
        const deltaWorldPos = desiredWorldPos.subtract(currentAimWorldPos);
        
        // 4. Convert that world delta into the Camera's local space (so we can move swayRoot)
        const invertedCameraMatrix = camera.getWorldMatrix().clone().invert();
        const localDelta = Vector3.TransformNormal(deltaWorldPos, invertedCameraMatrix);
        
        // 5. Calculate the final mathematically perfect ADS Position
        const mathematicalADSPos = swayRoot.position.add(localDelta);

        // Lerp SwayRoot position between Hipfire (basePos + reloadOffset) and Perfect ADS
        const hipfirePos = basePos.add(reloadOffset);
        const currentTargetPos = Vector3.Lerp(hipfirePos, mathematicalADSPos, adsProgress);
        
        // Apply Sway and Bob (diminished by ADS)
        const adsSwayMult = 1.0 - (adsProgress * 0.8); 
        swayRoot.rotation.y = swayX * adsSwayMult;
        swayRoot.rotation.x = reloadRotX + (swayY * adsSwayMult); 
        
        swayRoot.position.x = currentTargetPos.x + (bobX * adsSwayMult); 
        swayRoot.position.y = currentTargetPos.y + (bobY * adsSwayMult);
        swayRoot.position.z = currentTargetPos.z + kickbackZ; // Add kickback!
        
        kickbackZ = Scalar.Lerp(kickbackZ, 0, 15 * dt); // Spring back forward

        // Firing Additive Weight Lerp
        let targetFiringWeight = 0;
        if ((input.fire && currentAmmo > 0 && !isReloading) || performance.now() - lastFireTime < 150) {
            targetFiringWeight = 1.0;
        }
        
        if (firingAnimGroup) {
            currentFiringWeight = Scalar.Lerp(currentFiringWeight, targetFiringWeight, 15 * dt);
            firingAnimGroup.setWeightForAllAnimatables(currentFiringWeight);
        }

        // Base Layer Animation Update
        if (!playerState.isGrounded) {
            playAnim("jump");
        } else if (input.forward || input.backward || input.left || input.right) {
            playAnim("run");
        } else {
            playAnim("idle");
        }
    });
}
