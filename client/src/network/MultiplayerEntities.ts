import { Scene, AssetContainer, SceneLoader, Vector3, Quaternion, AnimationGroup, TransformNode, Mesh, ParticleSystem, Texture, Color4, StandardMaterial, Color3, MeshBuilder, PhysicsAggregate, PhysicsShapeType, PhysicsMotionType, PhysicsConstraint, PhysicsConstraintType } from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle, TextBlock } from "@babylonjs/gui";
import { spawnTracer } from "../ecs/systems/TracerSystem";
import { spawnImpact } from "../ecs/systems/ImpactSystem";
import { spawnDecal } from "../ecs/systems/DecalSystem";
import type { PlayerState } from "./NetworkManager";
import { AK47Builder } from "../physics/AK47Builder";
import { PistolBuilder } from "../physics/PistolBuilder";
import { M2010Builder } from "../physics/M2010Builder";

const RENDER_DELAY = 35; // ms

interface RemotePlayer {
    mesh: TransformNode; // Root node
    anims: Record<string, AnimationGroup>;
    currentState: string;
    stateBuffer: { time: number, position: Vector3, rotation: Quaternion, platformId?: string }[];
    flashSystem: ParticleSystem;
    fireAnimTimer: number;
    nameplate: Mesh;
    nameplateTexture: AdvancedDynamicTexture;
    weapons: Record<string, TransformNode>;
    activeWeaponId: string;
    muzzlePoints: Record<string, Mesh>;
}

export class MultiplayerEntities {
    private scene: Scene;
    private assetContainer: AssetContainer | null = null;
    private remotePlayers: Record<string, RemotePlayer> = {};
    private ragdolls: Map<string, PhysicsAggregate[]> = new Map();
    private ragdollConstraints: Map<string, PhysicsConstraint[]> = new Map();
    private hitboxMat: StandardMaterial;
    private _tempPos0 = new Vector3();
    private _tempPos1 = new Vector3();

    constructor(scene: Scene) {
        this.scene = scene;
        this.loadModel();

        this.hitboxMat = new StandardMaterial("hitboxMat", this.scene);
        this.hitboxMat.alpha = 0.0; // Invisible for gameplay
        this.hitboxMat.diffuseColor = new Color3(1, 0, 0);

        // Interpolation Loop
        this.scene.onBeforeRenderObservable.add(() => {
            this.interpolateEntities();
        });
    }

    public triggerFire(
        id: string, 
        origin?: Vector3, 
        hitPoint?: Vector3, 
        normal?: Vector3, 
        hitWall?: boolean
    ) {
        const player = this.remotePlayers[id];
        if (player) {
            player.flashSystem.manualEmitCount = 5;
            player.flashSystem.start();
            setTimeout(() => {
                player.flashSystem.stop();
            }, 50);
            
            player.fireAnimTimer = performance.now();
            if (player.currentState === "run" || player.currentState === "firing walk") {
                this.syncAnimation(player, "firing walk", false, true);
            } else {
                this.syncAnimation(player, "firing", false, true);
            }
        }

        if (origin && hitPoint && (origin.x !== 0 || origin.y !== 0 || origin.z !== 0 || hitPoint.x !== 0 || hitPoint.y !== 0 || hitPoint.z !== 0)) {
            // Spawn tracer line flying from remote shooter to hit position
            spawnTracer(origin, hitPoint);
            
            // If bullet hit a wall/environment, trigger impact smoke/sparks and decal
            if (hitWall && normal) {
                spawnImpact(hitPoint, normal);
                const offsetNormal = normal.scale(0.02);
                const decalPos = hitPoint.add(offsetNormal);
                spawnDecal(decalPos, decalPos.add(normal));
            }
        }
    }

    private async loadModel() {
        this.assetContainer = await SceneLoader.LoadAssetContainerAsync("./models/", `AnimatedSoldier.glb`, this.scene);
    }

    public updateNetworkState(globalState: Record<string, PlayerState>, localUsername: string) {
        if (!this.assetContainer) return; // Not loaded yet

        const now = performance.now();

        for (const id in globalState) {
            // Skip ourselves
            if (id === localUsername) continue;

            const state = globalState[id];

            // Detect respawns explicitly
            if (this.remotePlayers[id] && this.remotePlayers[id].currentState === "death" && !state.isDead) {
                this.removePlayer(id);
            }

            // Spawn new player if not tracking
            if (!this.remotePlayers[id]) {
                this.spawnPlayer(id, state);
            }

            const player = this.remotePlayers[id];
            
            // Buffer the new state for interpolation (offset Y by -0.9 to align feet to ground)
            if (player.stateBuffer.length >= 10) {
                const popped = player.stateBuffer.shift()!;
                popped.time = now;
                popped.position.set(state.x, state.y - 0.9, state.z);
                popped.rotation.set(state.rx, state.ry, state.rz, state.rw);
                popped.platformId = state.platformId;
                player.stateBuffer.push(popped);
            } else {
                player.stateBuffer.push({
                    time: now,
                    position: new Vector3(state.x, state.y - 0.9, state.z),
                    rotation: new Quaternion(state.rx, state.ry, state.rz, state.rw),
                    platformId: state.platformId
                });
            }

            // Sync animation state
            this.syncAnimation(player, state.anim, state.isDead, false);

            // Sync 3rd-person active weapon
            const currentWeapon = state.weaponId || "ak47";
            if (player.activeWeaponId !== currentWeapon && player.weapons[currentWeapon]) {
                if (player.weapons[player.activeWeaponId]) {
                    player.weapons[player.activeWeaponId].setEnabled(false);
                }
                player.weapons[currentWeapon].setEnabled(true);
                player.activeWeaponId = currentWeapon;
                if (player.muzzlePoints[currentWeapon]) {
                    player.flashSystem.emitter = player.muzzlePoints[currentWeapon];
                }
            }
        }

        // Cleanup disconnected players
        for (const id in this.remotePlayers) {
            if (!globalState[id]) {
                this.removePlayer(id);
            }
        }
    }

    private spawnPlayer(id: string, state: PlayerState) {
        if (!this.assetContainer) return;

        const entries = this.assetContainer.instantiateModelsToScene(name => `player_${id}_${name}`, false);
        const rootNode = entries.rootNodes[0] as TransformNode;
        rootNode.position = new Vector3(state.x, state.y - 0.9, state.z);
        if (!rootNode.rotationQuaternion) {
            rootNode.rotationQuaternion = Quaternion.Identity();
        }

        // Tag all meshes with playerId but DISABLE picking on them!
        // This is critical to avoid CPU skinning performance traps.
        rootNode.getChildMeshes().forEach(mesh => {
            mesh.metadata = { playerId: id };
            mesh.isPickable = false;
            // Prevent close-up frustum culling bugs for skeletal meshes by forcing them to always render
            mesh.alwaysSelectAsActiveMesh = true;
        });

        // Create the invisible bone colliders
        this.createHitboxes(rootNode, id);

        const anims: Record<string, AnimationGroup> = {};
        entries.animationGroups.forEach(ag => {
            anims[ag.name] = ag;
            
            // Setup per-animation blending
            if (ag.targetedAnimations) {
                const isFiring = ag.name.toLowerCase().includes("fire") || ag.name.toLowerCase().includes("firing");
                ag.targetedAnimations.forEach((ta: any) => {
                    ta.animation.enableBlending = !isFiring;
                    ta.animation.blendingSpeed = 0.05;
                });

                // Strip Root Motion from Jump animation programmatically
                if (ag.name.toLowerCase().includes("jump")) {
                    ag.targetedAnimations.forEach((ta: any) => {
                        // Find the position track for the Hips/Root bone
                        if (ta.target && ta.target.name && ta.target.name.toLowerCase().includes("hips") && ta.animation.targetProperty === "position") {
                            const keys = ta.animation.getKeys();
                            if (keys && keys.length > 0) {
                                const firstFramePos = keys[0].value.clone();
                                // Lock all frames to the first frame's position (strips X, Y, Z root motion, making it perfectly "In-Place")
                                keys.forEach((key: any) => {
                                    if (key.value && key.value.copyFrom) {
                                        key.value.copyFrom(firstFramePos);
                                    }
                                });
                            }
                        }
                    });
                }
            }
            
            ag.stop();
        });

        // Scale model slightly so it matches player height
        rootNode.scaling = new Vector3(0.9, 0.9, 0.9);

        // --- WEAPON ATTACHMENT ---
        const weapons: Record<string, TransformNode> = {};
        const muzzlePoints: Record<string, Mesh> = {};

        // Search for the RightHand linked transform node in the instantiated hierarchy
        let rightHandTransform: TransformNode | undefined;
        rootNode.getChildTransformNodes(false).forEach(node => {
            if (node.name.includes("RightHand")) {
                rightHandTransform = node;
            }
        });

        const initialWeapon = state.weaponId || "ak47";

        if (rightHandTransform) {
            // 1. Procedural 3P AK47
            const ak3p = AK47Builder.Build(this.scene);
            ak3p.scaling = new Vector3(0.12, 0.12, 0.12);
            ak3p.setParent(rightHandTransform);
            ak3p.position = new Vector3(-0.05, 0.05, 0);
            ak3p.rotation = new Vector3(Math.PI / 2, 0, 0);
            ak3p.getChildMeshes().forEach((m: any) => {
                m.alwaysSelectAsActiveMesh = true;
                m.isPickable = false;
            });
            weapons["ak47"] = ak3p;

            const akMuzzle = new Mesh(`muzzle_ak_${id}`, this.scene);
            akMuzzle.parent = ak3p;
            akMuzzle.position = new Vector3(0, 0.15, 3.4);
            muzzlePoints["ak47"] = akMuzzle;

            // 2. Procedural 3P Pistol
            const pistol3p = PistolBuilder.Build(this.scene);
            pistol3p.scaling = new Vector3(0.12, 0.12, 0.12);
            pistol3p.setParent(rightHandTransform);
            pistol3p.position = new Vector3(-0.04, 0.04, 0);
            pistol3p.rotation = new Vector3(Math.PI / 2, 0, 0);
            pistol3p.getChildMeshes().forEach((m: any) => {
                m.alwaysSelectAsActiveMesh = true;
                m.isPickable = false;
            });
            weapons["pistol"] = pistol3p;

            const pistolMuzzle = new Mesh(`muzzle_pistol_${id}`, this.scene);
            pistolMuzzle.parent = pistol3p;
            pistolMuzzle.position = new Vector3(0, 0.2, 0.7);
            muzzlePoints["pistol"] = pistolMuzzle;

            // 3. Procedural 3P M2010 Sniper Rifle
            const m2010_3p = M2010Builder.Build(this.scene);
            m2010_3p.scaling = new Vector3(0.12, 0.12, 0.12);
            m2010_3p.setParent(rightHandTransform);
            m2010_3p.position = new Vector3(-0.05, 0.05, 0);
            m2010_3p.rotation = new Vector3(Math.PI / 2, 0, 0);
            m2010_3p.getChildMeshes().forEach((m: any) => {
                m.alwaysSelectAsActiveMesh = true;
                m.isPickable = false;
            });
            weapons["m2010"] = m2010_3p;

            const m2010Muzzle = new Mesh(`muzzle_m2010_${id}`, this.scene);
            m2010Muzzle.parent = m2010_3p;
            m2010Muzzle.position = new Vector3(0, 0.05, 1.25);
            muzzlePoints["m2010"] = m2010Muzzle;

            // Show active weapon, hide inactive
            Object.keys(weapons).forEach(wKey => {
                weapons[wKey].setEnabled(wKey === initialWeapon);
            });
        }

        const activeMuzzle = muzzlePoints[initialWeapon] || rootNode;

        // --- MUZZLE FLASH SYSTEM ---
        const flash = new ParticleSystem(`flash_${id}`, 50, this.scene);
        flash.particleTexture = new Texture("https://playground.babylonjs.com/textures/flare.png", this.scene);
        flash.emitter = activeMuzzle;
        flash.minEmitBox = new Vector3(0, 0, 0);
        flash.maxEmitBox = new Vector3(0, 0, 0);
        flash.color1 = new Color4(1, 0.8, 0.1, 1);
        flash.color2 = new Color4(1, 0.5, 0.1, 1);
        flash.colorDead = new Color4(0, 0, 0, 0.0);
        flash.minSize = 0.2;
        flash.maxSize = 0.5;
        flash.minLifeTime = 0.02;
        flash.maxLifeTime = 0.05;
        flash.emitRate = 1000;
        flash.blendMode = ParticleSystem.BLENDMODE_ADD;
        flash.gravity = new Vector3(0, 0, 0);
        flash.direction1 = new Vector3(0, 0, 1);
        flash.direction2 = new Vector3(0, 0, 1);
        flash.minAngularSpeed = 0;
        flash.maxAngularSpeed = Math.PI;
        flash.minEmitPower = 0;
        flash.maxEmitPower = 0;
        flash.updateSpeed = 0.02;

        // --- NAMEPLATE UI (3D World Space) ---
        // Floating above head, facing camera
        const nameplatePlane = MeshBuilder.CreatePlane(`nameplate_${id}`, { width: 1.5, height: 0.3 }, this.scene);
        nameplatePlane.parent = rootNode;
        nameplatePlane.position.y = 2.0; // Above head
        nameplatePlane.position.z = 0;
        nameplatePlane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        nameplatePlane.isPickable = false;
        
        // Use a specific texture resolution that matches the plane's aspect ratio (5:1)
        const adt = AdvancedDynamicTexture.CreateForMesh(nameplatePlane, 512, 102);
        
        const rect = new Rectangle();
        rect.width = "100%";
        rect.height = "100%";
        rect.color = "white";
        rect.thickness = 0;
        rect.background = "rgba(0, 0, 0, 0.4)";
        rect.cornerRadius = 10;
        adt.addControl(rect);
        
        const label = new TextBlock();
        label.text = id;
        label.color = "white";
        // Font size is relative to the 102px height texture
        label.fontSize = 75; 
        label.fontFamily = "monospace";
        label.fontWeight = "bold";
        rect.addControl(label);

        this.remotePlayers[id] = {
            mesh: rootNode,
            anims: anims,
            currentState: "idle",
            stateBuffer: [],
            flashSystem: flash,
            fireAnimTimer: 0,
            nameplate: nameplatePlane,
            nameplateTexture: adt,
            weapons: weapons,
            activeWeaponId: initialWeapon,
            muzzlePoints: muzzlePoints
        };
    }

    private removePlayer(id: string) {
        const player = this.remotePlayers[id];
        if (player) {
            if (player.nameplateTexture) player.nameplateTexture.dispose();
            if (player.nameplate) player.nameplate.dispose();
            if (player.flashSystem) player.flashSystem.dispose();
            if (player.mesh) player.mesh.dispose(false, false); // DO NOT dispose materials as they are shared via AssetContainer!
            delete this.remotePlayers[id];
        }

        // Dispose Constraints
        const constraints = this.ragdollConstraints.get(id);
        if (constraints) {
            constraints.forEach(c => c.dispose());
            this.ragdollConstraints.delete(id);
        }

        // Dispose Ragdoll Bodies & Meshes
        const bodies = this.ragdolls.get(id);
        if (bodies) {
            bodies.forEach(agg => {
                if (agg.transformNode) {
                    agg.transformNode.dispose(); // This deletes the invisible hitbox mesh
                }
                agg.dispose(); // This removes it from Havok
            });
            this.ragdolls.delete(id);
        }
    }

    private syncAnimation(player: RemotePlayer, networkAnim: string, isDead: boolean, forceRestart: boolean = false) {
        if (isDead) {
            player.mesh.getChildMeshes().forEach(m => m.isPickable = false);
            if (player.currentState !== "death") {
                player.currentState = "death";
                // Stop all animations and play death animation if available
                for (const name in player.anims) {
                    player.anims[name].stop();
                }
                // Try to play a death animation
                const deathAnim = Object.values(player.anims).find(ag => 
                    ag.name.toLowerCase().includes("death") || ag.name.toLowerCase().includes("dying")
                );
                if (deathAnim) {
                    deathAnim.start(false, 1.0, deathAnim.from, deathAnim.to, false);
                }
            }
            return;
        }

        player.mesh.getChildMeshes().forEach(m => m.isPickable = true);

        networkAnim = networkAnim || "idle";
        
        if (networkAnim !== "firing" && networkAnim !== "firing walk" && player.fireAnimTimer && performance.now() - player.fireAnimTimer < 250) {
            // If they were doing a firing animation, keep doing it instead of dropping to idle/run
            if (player.currentState === "firing" || player.currentState === "firing walk") {
                networkAnim = player.currentState;
            } else {
                networkAnim = "firing";
            }
        }

        // Only switch animations if the requested animation changed (or if forced)
        if (player.currentState !== networkAnim || forceRestart) {
            // Stop current animations
            for (const name in player.anims) {
                player.anims[name].stop();
            }

            let animFound = false;
            // Try exact match, or fallback to includes
            for (const name in player.anims) {
                const lowerName = name.toLowerCase();
                const lowerNet = networkAnim.toLowerCase();
                
                // If asking for "firing", don't accidentally get "firing walk"
                if (lowerNet === "firing" && lowerName.includes("firing") && !lowerName.includes("walk")) {
                    player.anims[name].start(true, 1.0, player.anims[name].from, player.anims[name].to, false); 
                    animFound = true;
                    break;
                } else if (lowerNet !== "firing" && lowerName.includes(lowerNet)) {
                    player.anims[name].start(true, 1.0, player.anims[name].from, player.anims[name].to, false); 
                    animFound = true;
                    break;
                }
            }
            
            // Fallback for idle if missing
            if (!animFound && networkAnim === "idle" && player.anims["TPose"]) {
                player.anims["TPose"].start(true, 1.0, player.anims["TPose"].from, player.anims["TPose"].to, false);
            }
            player.currentState = networkAnim;
        }
    }

    private interpolateEntities() {
        const renderTime = performance.now() - RENDER_DELAY;

        for (const id in this.remotePlayers) {
            const player = this.remotePlayers[id];
            const buffer = player.stateBuffer;

            if (buffer.length < 2) continue;

            let state0, state1;
            for (let i = 0; i < buffer.length - 1; i++) {
                if (buffer[i].time <= renderTime && buffer[i+1].time >= renderTime) {
                    state0 = buffer[i];
                    state1 = buffer[i+1];
                    break;
                }
            }

            if (state0 && state1) {
                const alpha = (renderTime - state0.time) / (state1.time - state0.time);
                
                this._tempPos0.copyFrom(state0.position);
                if (state0.platformId) {
                    const platform0 = this.scene.getMeshByName(state0.platformId);
                    if (platform0) {
                        Vector3.TransformCoordinatesToRef(this._tempPos0, platform0.getWorldMatrix(), this._tempPos0);
                    }
                }

                this._tempPos1.copyFrom(state1.position);
                if (state1.platformId) {
                    const platform1 = this.scene.getMeshByName(state1.platformId);
                    if (platform1) {
                        Vector3.TransformCoordinatesToRef(this._tempPos1, platform1.getWorldMatrix(), this._tempPos1);
                    }
                }

                // Interpolate Position in World Space
                Vector3.LerpToRef(this._tempPos0, this._tempPos1, alpha, player.mesh.position);
                
                // Interpolate Rotation
                if (player.mesh.rotationQuaternion) {
                    Quaternion.SlerpToRef(state0.rotation, state1.rotation, alpha, player.mesh.rotationQuaternion);
                }

                // Force update world matrix and bounding boxes to prevent frustum culling disappearance 
                player.mesh.computeWorldMatrix(true);
                player.mesh.getChildMeshes(false).forEach(m => m.refreshBoundingInfo(true, true));
            }
        }
    }

    private createHitboxes(rootNode: TransformNode, id: string) {
        const nodes = rootNode.getChildTransformNodes(false);
        const findNode = (name: string) => nodes.find(n => n.name.toLowerCase().includes(name.toLowerCase()));

        const headNode = findNode("Head");
        const spineNode = findNode("Spine2") || findNode("Spine");
        const leftArmNode = findNode("LeftArm");
        const rightArmNode = findNode("RightArm");
        const leftForeArmNode = findNode("LeftForeArm");
        const rightForeArmNode = findNode("RightForeArm");
        const leftLegNode = findNode("LeftUpLeg");
        const rightLegNode = findNode("RightUpLeg");
        const leftCalfNode = findNode("LeftLeg"); // mixamo usually calls calf "LeftLeg"
        const rightCalfNode = findNode("RightLeg");
        const ragdollBodies: PhysicsAggregate[] = [];
        this.ragdolls.set(id, ragdollBodies);

        const makeHitbox = (zone: string, type: "sphere"|"box"|"cylinder", size: any, mult: number, parentNode: TransformNode | undefined, offset: Vector3, rotation?: Vector3): PhysicsAggregate | null => {
            if (!parentNode) return null;
            let mesh: Mesh;
            let shapeType: PhysicsShapeType;
            if (type === "sphere") {
                mesh = MeshBuilder.CreateSphere(`hitbox_${id}_${zone}`, size, this.scene);
                shapeType = PhysicsShapeType.SPHERE;
            } else if (type === "box") {
                mesh = MeshBuilder.CreateBox(`hitbox_${id}_${zone}`, size, this.scene);
                shapeType = PhysicsShapeType.BOX;
            } else {
                mesh = MeshBuilder.CreateCylinder(`hitbox_${id}_${zone}`, size, this.scene);
                shapeType = PhysicsShapeType.CAPSULE;
            }
            
            mesh.setParent(parentNode);
            mesh.position = offset;
            mesh.rotation = rotation ? rotation : Vector3.Zero();
            
            mesh.material = this.hitboxMat;
            mesh.isPickable = false; // We use Havok raycast now, no need for Babylon picking
            
            // Critical metadata for WeaponSystem raycast
            mesh.metadata = { isHitbox: true, playerId: id, zone: zone, multiplier: mult, aggregateIndex: ragdollBodies.length };

            // Attach Havok Physics Aggregate
            const aggregate = new PhysicsAggregate(mesh, shapeType, { mass: 10 }, this.scene); // Give mass so it can fall as ragdoll
            
            // Fix 1: Make it follow the animation perfectly instead of being stuck at spawn
            aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
            aggregate.body.disablePreStep = false;

            // Fix 2: Set as trigger so players don't walk into an invisible wall
            // Triggers don't physically bump into anything, but they CAN be raycasted!
            aggregate.shape.isTrigger = true; 
            
            ragdollBodies.push(aggregate);
            return aggregate;
        };

        // Note: The character was exported from Blender in meters. 
        // We must define these in meters (e.g. 0.2 instead of 20).
        
        // We must push in exact order for ragdoll joints:
        // Torso=0, Head=1, LArm=2, RArm=3, LFArm=4, RFArm=5, LLeg=6, RLeg=7, LCalf=8, RCalf=9
        makeHitbox("torso", "box", { width: 0.35, height: 0.45, depth: 0.25 }, 1.0, spineNode, new Vector3(0, 0.1, 0));
        makeHitbox("head", "cylinder", { diameter: 0.22, height: 0.4 }, 2.5, headNode, new Vector3(0, 0, 0));
        makeHitbox("arm", "cylinder", { diameter: 0.12, height: 0.25 }, 0.8, leftArmNode, new Vector3(0, 0.12, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("arm", "cylinder", { diameter: 0.12, height: 0.25 }, 0.8, rightArmNode, new Vector3(0, 0.12, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("arm", "cylinder", { diameter: 0.10, height: 0.25 }, 0.8, leftForeArmNode, new Vector3(0, 0.12, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("arm", "cylinder", { diameter: 0.10, height: 0.25 }, 0.8, rightForeArmNode, new Vector3(0, 0.12, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("leg", "cylinder", { diameter: 0.16, height: 0.65 }, 0.6, leftLegNode, new Vector3(0, 0.325, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("leg", "cylinder", { diameter: 0.16, height: 0.65 }, 0.6, rightLegNode, new Vector3(0, 0.325, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("leg", "cylinder", { diameter: 0.14, height: 0.65 }, 0.6, leftCalfNode, new Vector3(0, 0.325, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("leg", "cylinder", { diameter: 0.14, height: 0.65 }, 0.6, rightCalfNode, new Vector3(0, 0.325, 0), new Vector3(0, Math.PI/2, 0));
    }

    public triggerRagdoll(id: string, hitZone?: string, impulseDir?: Vector3) {
        const bodies = this.ragdolls.get(id);
        const player = this.remotePlayers[id];
        
        // Stop all animations
        if (player) {
            for (const name in player.anims) {
                player.anims[name].stop();
            }
        }
        
        if (bodies && bodies.length === 10) {
            // First detach and make dynamic
            bodies.forEach((agg) => {
                if (agg.transformNode.parent) {
                    const absPos = agg.transformNode.getAbsolutePosition();
                    const absRot = agg.transformNode.absoluteRotationQuaternion;
                    agg.transformNode.setParent(null);
                    agg.transformNode.position.copyFrom(absPos);
                    if (absRot) agg.transformNode.rotationQuaternion = absRot;
                }
                agg.shape.isTrigger = false;
                agg.body.setMotionType(PhysicsMotionType.DYNAMIC);
                
                if (impulseDir && agg.transformNode.metadata?.zone === hitZone) {
                    const mass = agg.body.getMassProperties()?.mass ?? 10;
                    agg.body.applyImpulse(impulseDir.scale(mass * 5), agg.transformNode.position);
                }
            });

            const constraints: PhysicsConstraint[] = [];
            
            // Now apply Constraints (so Havok doesn't crash from kinematic bodies)
            const connect = (parent: PhysicsAggregate, child: PhysicsAggregate, pivotA: Vector3, pivotB: Vector3) => {
                const constraint = new PhysicsConstraint(PhysicsConstraintType.BALL_AND_SOCKET, {
                    pivotA: pivotA, pivotB: pivotB
                }, this.scene);
                parent.body.addConstraint(child.body, constraint);
                constraints.push(constraint);
            };

            const [torso, head, lArm, rArm, lFArm, rFArm, lLeg, rLeg, lCalf, rCalf] = bodies;
            
            connect(torso, head, new Vector3(0, 0.3, 0), new Vector3(0, -0.2, 0));
            connect(torso, lArm, new Vector3(-0.2, 0.2, 0), new Vector3(0, -0.12, 0));
            connect(torso, rArm, new Vector3(0.2, 0.2, 0), new Vector3(0, -0.12, 0));
            connect(lArm, lFArm, new Vector3(0, 0.12, 0), new Vector3(0, -0.12, 0));
            connect(rArm, rFArm, new Vector3(0, 0.12, 0), new Vector3(0, -0.12, 0));
            connect(torso, lLeg, new Vector3(-0.15, -0.2, 0), new Vector3(0, -0.275, 0));
            connect(torso, rLeg, new Vector3(0.15, -0.2, 0), new Vector3(0, -0.275, 0));
            connect(lLeg, lCalf, new Vector3(0, 0.275, 0), new Vector3(0, -0.275, 0));
            connect(rLeg, rCalf, new Vector3(0, 0.275, 0), new Vector3(0, -0.275, 0));
            
            this.ragdollConstraints.set(id, constraints);
        }
    }
}
