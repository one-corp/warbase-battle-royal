import { Scene, AssetContainer, SceneLoader, Vector3, Quaternion, AnimationGroup, TransformNode, Mesh, ParticleSystem, Texture, Color4, StandardMaterial, Color3, MeshBuilder } from "@babylonjs/core";
import type { PlayerState } from "./NetworkManager";

const RENDER_DELAY = 100; // ms

interface RemotePlayer {
    mesh: TransformNode; // Root node
    anims: Record<string, AnimationGroup>;
    currentState: string;
    stateBuffer: { time: number, position: Vector3, rotation: Quaternion }[];
    flashSystem: ParticleSystem;
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

        // Tag all meshes with playerId so hitscan raycasts know who was hit
        rootNode.getChildMeshes().forEach(mesh => {
            mesh.metadata = { playerId: id };
        });

        const anims: Record<string, AnimationGroup> = {};
        entries.animationGroups.forEach(ag => {
            anims[ag.name] = ag;
            ag.stop();
        });

        // Scale model slightly so it matches player height
        rootNode.scaling = new Vector3(0.9, 0.9, 0.9);

        // --- WEAPON ATTACHMENT ---
        let muzzlePoint = new Mesh(`muzzle_${id}`, this.scene);
        
        let rightHandBone: any = null;
        if (entries.skeletons && entries.skeletons.length > 0) {
            entries.skeletons[0].bones.forEach((bone: any) => {
                if (bone.name.includes("RightHand")) {
                    rightHandBone = bone;
                }
            });
        }

        if (rightHandBone) {
            const weaponSocket = new TransformNode("WeaponSocket", this.scene);
            weaponSocket.attachToBone(rightHandBone, rootNode);

            // Build a procedural 3rd-person gun (simplified AK)
            const matteBlack = new StandardMaterial("matteBlack", this.scene);
            matteBlack.diffuseColor = new Color3(0.1, 0.1, 0.1);

            const gunRoot = new TransformNode("ak47_3p", this.scene);
            gunRoot.parent = weaponSocket;
            
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

            // Orient the gun to point forward from the hand
            gunRoot.rotation = new Vector3(Math.PI / 2, 0, 0); 
            gunRoot.scaling = new Vector3(0.5, 0.5, 0.5); // 3rd person scale
            
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
        flash.particleTexture = new Texture("https://raw.githubusercontent.com/BabylonJS/Babylon.js/master/packages/tools/Playground/public/textures/flare.png", this.scene);
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
            flashSystem: flash
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
        }
    }

    private removePlayer(id: string) {
        const player = this.remotePlayers[id];
        if (player) {
            player.mesh.dispose();
            delete this.remotePlayers[id];
        }
    }

    private syncAnimation(player: RemotePlayer, networkAnim: string, isDead: boolean) {
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
                    if (name.toLowerCase().includes("death")) {
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

        // Only switch animations if the requested animation changed
        if (player.currentState !== networkAnim) {
            // Stop current animations
            for (const name in player.anims) {
                player.anims[name].stop();
            }

            let animFound = false;
            // Try exact match, or fallback to includes
            for (const name in player.anims) {
                if (name.toLowerCase().includes(networkAnim.toLowerCase())) {
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
}
