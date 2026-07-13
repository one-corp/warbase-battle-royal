import { Scene, AssetContainer, SceneLoader, Vector3, Quaternion, AnimationGroup, TransformNode, Mesh, ParticleSystem, Texture, Color4, StandardMaterial, Color3, MeshBuilder, PhysicsAggregate, PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core";
import type { PlayerState } from "./NetworkManager";

const RENDER_DELAY = 100; // ms

interface RemotePlayer {
    mesh: TransformNode; // Root node
    anims: Record<string, AnimationGroup>;
    currentState: string;
    stateBuffer: { time: number, position: Vector3, rotation: Quaternion }[];
    flashSystem: ParticleSystem;
    fireAnimTimer: number;
}

export class MultiplayerEntities {
    private scene: Scene;
    private assetContainer: AssetContainer | null = null;
    private remotePlayers: Record<string, RemotePlayer> = {};

    constructor(scene: Scene) {
        this.scene = scene;
        this.loadModel();

        // Interpolation Loop
        this.scene.onBeforeRenderObservable.add(() => {
            this.interpolateEntities();
        });
    }

    private async loadModel() {
        this.assetContainer = await SceneLoader.LoadAssetContainerAsync("./models/", `AnimatedSoldier.glb?v=${Date.now()}`, this.scene);
    }

    public updateNetworkState(globalState: Record<string, PlayerState>, localUsername: string) {
        if (!this.assetContainer) return; // Not loaded yet

        const now = performance.now();

        for (const id in globalState) {
            // Skip ourselves
            if (id === localUsername) continue;

            const state = globalState[id];

            // Spawn new player if not tracking
            if (!this.remotePlayers[id]) {
                this.spawnPlayer(id, state);
            }

            const player = this.remotePlayers[id];
            
            // Buffer the new state for interpolation (offset Y by -0.9 to align feet to ground)
            player.stateBuffer.push({
                time: now,
                position: new Vector3(state.x, state.y - 0.9, state.z),
                rotation: new Quaternion(state.rx, state.ry, state.rz, state.rw)
            });

            // Keep buffer small
            if (player.stateBuffer.length > 10) {
                player.stateBuffer.shift();
            }

            // Sync Animation
            this.syncAnimation(player, state.anim, state.isDead);
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
            mesh.doNotSyncBoundingInfo = true;
            mesh.alwaysSelectAsActiveMesh = true; // Fix disappearing body bug!
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
        let muzzlePoint = new Mesh(`muzzle_${id}`, this.scene);

        // Search for the RightHand linked transform node in the instantiated hierarchy
        let rightHandTransform: TransformNode | undefined;
        rootNode.getChildTransformNodes(false).forEach(node => {
            if (node.name.includes("RightHand")) {
                rightHandTransform = node;
            }
        });

        if (rightHandTransform) {
            // Build a procedural 3rd-person gun (simplified AK)
            const matteBlack = new StandardMaterial("matteBlack", this.scene);
            matteBlack.diffuseColor = new Color3(0.1, 0.1, 0.1);

            const gunRoot = new TransformNode("ak47_3p", this.scene);
            
            // Receiver
            const receiver = MeshBuilder.CreateBox("receiver", { width: 0.05, height: 0.08, depth: 0.3 }, this.scene);
            receiver.position = new Vector3(0, 0.04, 0.1);
            receiver.material = matteBlack;
            receiver.parent = gunRoot;
            
            // Barrel
            const barrel = MeshBuilder.CreateCylinder("barrel", { diameter: 0.02, height: 0.4 }, this.scene);
            barrel.rotation.x = Math.PI / 2;
            barrel.position = new Vector3(0, 0.06, 0.45);
            barrel.material = matteBlack;
            barrel.parent = gunRoot;

            // Set the desired world scale FIRST
            gunRoot.scaling = new Vector3(0.5, 0.5, 0.5); // 3rd person scale
            
            // Use setParent to maintain absolute scale (prevents weapon from shrinking due to bone's 0.01 scale)
            gunRoot.setParent(rightHandTransform);

            // Orient and position the gun relative to the hand
            gunRoot.position = new Vector3(-0.1, 0.1, 0);
            gunRoot.rotation = new Vector3(Math.PI / 2, 0, 0); 
            
            // Prevent frustum culling and picking
            gunRoot.getChildMeshes().forEach((m: any) => {
                m.alwaysSelectAsActiveMesh = true;
                m.isPickable = false;
            });

            muzzlePoint.parent = gunRoot;
            muzzlePoint.position = new Vector3(0, 0.06, 0.65); // End of barrel
        } else {
            muzzlePoint.parent = rootNode;
            muzzlePoint.position = new Vector3(0, 1.2, 0.5);
        }

        // --- MUZZLE FLASH SYSTEM ---
        const flash = new ParticleSystem(`flash_${id}`, 50, this.scene);
        flash.particleTexture = new Texture("https://playground.babylonjs.com/textures/flare.png", this.scene);
        flash.emitter = muzzlePoint;
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

        this.remotePlayers[id] = {
            mesh: rootNode,
            anims: anims,
            currentState: "idle",
            stateBuffer: [],
            flashSystem: flash,
            fireAnimTimer: 0
        };
    }

    public triggerFire(id: string) {
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
    }

    private removePlayer(id: string) {
        const player = this.remotePlayers[id];
        if (player) {
            player.mesh.dispose();
            delete this.remotePlayers[id];
        }
    }

    private syncAnimation(player: RemotePlayer, networkAnim: string, isDead: boolean, forceRestart: boolean = false) {
        if (isDead) {
            player.mesh.getChildMeshes().forEach(m => m.isPickable = false);
            if (player.currentState !== "death") {
                // Stop current
                if (player.anims[player.currentState]) {
                    player.anims[player.currentState].stop();
                }
                player.currentState = "death";
                
                // Find death anim
                for (const name in player.anims) {
                    if (name.toLowerCase().includes("death") || name.toLowerCase().includes("dying")) {
                        // Play once, don't loop
                        player.anims[name].start(false, 1.0, player.anims[name].from, player.anims[name].to, false);
                        break;
                    }
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
                
                // Interpolate Position
                Vector3.LerpToRef(state0.position, state1.position, alpha, player.mesh.position);
                
                // Interpolate Rotation
                if (player.mesh.rotationQuaternion) {
                    Quaternion.SlerpToRef(state0.rotation, state1.rotation, alpha, player.mesh.rotationQuaternion);
                }
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

        // We make them slightly visible for debugging purposes (alpha 0.0), 
        // normally we would set isVisible = false
        const hitboxMat = new StandardMaterial("hitboxMat", this.scene);
        hitboxMat.alpha = 0.4; // Make hitboxes visible to debug hit registration!
        hitboxMat.diffuseColor = new Color3(1, 0, 0);

        const makeHitbox = (zone: string, type: "sphere"|"box"|"cylinder", size: any, mult: number, parentNode: TransformNode | undefined, offset: Vector3, rotation?: Vector3) => {
            if (!parentNode) return;
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
            if (rotation) mesh.rotation = rotation;
            
            mesh.material = hitboxMat;
            mesh.isPickable = false; // We use Havok raycast now, no need for Babylon picking
            mesh.alwaysSelectAsActiveMesh = true; // prevent frustum culling issues when parent is out of view
            
            // Critical metadata for WeaponSystem raycast
            mesh.metadata = { isHitbox: true, playerId: id, zone: zone, multiplier: mult };

            // Attach Havok Physics Aggregate
            const aggregate = new PhysicsAggregate(mesh, shapeType, { mass: 0 }, this.scene);
            
            // Fix 1: Make it follow the animation perfectly instead of being stuck at spawn
            aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
            aggregate.body.disablePreStep = false;

            // Fix 2: Set as trigger so players don't walk into an invisible wall
            // Triggers don't physically bump into anything, but they CAN be raycasted!
            aggregate.shape.isTrigger = true; 
        };

        // Note: The character was exported from Blender in meters. 
        // We must define these in meters (e.g. 0.2 instead of 20).
        // Head
        makeHitbox("head", "cylinder", { diameter: 0.22, height: 0.4 }, 2.5, headNode, new Vector3(0, 0, 0));
        
        // Torso
        makeHitbox("torso", "box", { width: 0.35, height: 0.45, depth: 0.25 }, 1.0, spineNode, new Vector3(0, 0.1, 0));
        
        // Upper Arms
        makeHitbox("arm", "cylinder", { diameter: 0.12, height: 0.25 }, 0.8, leftArmNode, new Vector3(0, 0.12, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("arm", "cylinder", { diameter: 0.12, height: 0.25 }, 0.8, rightArmNode, new Vector3(0, 0.12, 0), new Vector3(0, Math.PI/2, 0));
        
        // Lower Arms
        makeHitbox("arm", "cylinder", { diameter: 0.10, height: 0.25 }, 0.8, leftForeArmNode, new Vector3(0, 0.12, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("arm", "cylinder", { diameter: 0.10, height: 0.25 }, 0.8, rightForeArmNode, new Vector3(0, 0.12, 0), new Vector3(0, Math.PI/2, 0));
        
        // Upper Legs
        makeHitbox("leg", "cylinder", { diameter: 0.16, height: 0.45 }, 0.6, leftLegNode, new Vector3(0, 0.22, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("leg", "cylinder", { diameter: 0.16, height: 0.45 }, 0.6, rightLegNode, new Vector3(0, 0.22, 0), new Vector3(0, Math.PI/2, 0));
        
        // Lower Legs (Calves)
        makeHitbox("leg", "cylinder", { diameter: 0.14, height: 0.45 }, 0.6, leftCalfNode, new Vector3(0, 0.22, 0), new Vector3(0, Math.PI/2, 0));
        makeHitbox("leg", "cylinder", { diameter: 0.14, height: 0.45 }, 0.6, rightCalfNode, new Vector3(0, 0.22, 0), new Vector3(0, Math.PI/2, 0));
    }
}
