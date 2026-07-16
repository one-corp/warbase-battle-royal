import './ui/style.css';
import {
    Scene,
    Vector3,
    DirectionalLight,
    Engine,
    HavokPlugin,
    Quaternion,
    CubeTexture,
    CascadedShadowGenerator,
    DefaultRenderingPipeline,
    ImageProcessingConfiguration,
    WebGPUEngine,
    Ray
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import "@babylonjs/loaders/glTF"; 
import { EnvironmentManager } from './engine/Environment';
import { initPlayer } from './ecs/systems/PlayerSystem';
import { playerMovementSystem } from './ecs/systems/PlayerMovementSystem';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { InputComponent, PlayerComponent, Position } from './ecs/Components';
import { entityCameras, entityMeshes, entityPhysicsBodies } from './ecs/ViewMaps';
import { world } from './ecs/World';
import { WeaponSystem } from './physics/WeaponSystem';
import { NetworkManager } from "./network/NetworkManager";
import { MultiplayerEntities } from "./network/MultiplayerEntities";

import { MainMenuScene } from "./engine/MainMenuScene";

export let currentEngineType = "WebGL 2.0";
export let activeScene: Scene | null = null;

async function initEngine(canvas: HTMLCanvasElement): Promise<Engine | WebGPUEngine> {
    // Temporarily disabled WebGPU because it's causing a RenderPipeline crash on the GLB map
    // if (await WebGPUEngine.IsSupportedAsync) {
    //     let engine;
    //     try {
    //         engine = new WebGPUEngine(canvas);
    //         await engine.initAsync();
    //         currentEngineType = "WebGPU";
    //         return engine;
    //     } catch (e) {
    //         console.error("WebGPU initialization failed:", e);
    //         const errorElement = document.getElementById("errorDisplay");
    //         if (errorElement) errorElement.innerText = "Error: WebGPU failed to initialize. Please check your browser compatibility.";
    //     }
    // } else {
    //     console.warn("WebGPU not supported by this browser, falling back to WebGL 2.0");
    // }
    
    currentEngineType = "WebGL 2.0";
    return new Engine(canvas, true);
}

async function createScene(engine: Engine | WebGPUEngine, canvas: HTMLCanvasElement, mapChoice: string) {
    const scene = new Scene(engine);
    
    scene.collisionsEnabled = true;
    scene.gravity = new Vector3(0, -9.81, 0);

    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.81, 0), hk);

    // 1. Image Based Lighting & Skybox (Switched to standard neutral environment)
    const envTexture = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.env", scene);
    scene.environmentTexture = envTexture;
    scene.createDefaultSkybox(envTexture, true, 1000, 0.3);

    // 2. Realistic Sun Lighting & Cascaded Shadows
    const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
    sun.position = new Vector3(20, 40, 20);
    sun.intensity = 2.0;

    const shadowGenerator = new CascadedShadowGenerator(2048, sun);
    shadowGenerator.stabilizeCascades = true;
    shadowGenerator.forceBackFacesOnly = true;
    shadowGenerator.shadowMaxZ = 200;
    shadowGenerator.usePercentageCloserFiltering = true;
    
    const envManager = new EnvironmentManager(scene, shadowGenerator, mapChoice);
    await envManager.init();
    const playerEid = initPlayer(scene, canvas);
    const camera = entityCameras.get(playerEid);
    
    // Explicitly enforce the player camera as the active camera (in case a GLB somehow overrode it)
    if (camera) scene.activeCamera = camera;

    // 3. Cinematic Post-Processing (Optimized for Web)
    const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, camera ? [camera] : []);
    pipeline.fxaaEnabled = true; 

    // Tone Mapping & Color Grading
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure = 1.0;
    pipeline.imageProcessing.contrast = 1.2; // Adds a gritty, contrast-heavy FPS look (Zero cost)

    // Stylized Camera Lens Effects
    pipeline.chromaticAberrationEnabled = false;

    // Bloom
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.8;
    pipeline.bloomWeight = 0.3;

    // --- Graphics UI Hookup ---
    const tChromatic = document.getElementById("toggleChromatic") as HTMLInputElement;
    const tBloom = document.getElementById("toggleBloom") as HTMLInputElement;
    
    if (tChromatic) {
        tChromatic.checked = pipeline.chromaticAberrationEnabled;
        tChromatic.addEventListener("change", (e) => {
            pipeline.chromaticAberrationEnabled = (e.target as HTMLInputElement).checked;
            if (pipeline.chromaticAberrationEnabled && pipeline.chromaticAberration) {
                pipeline.chromaticAberration.aberrationAmount = 30.0;
                pipeline.chromaticAberration.radialIntensity = 1.0;
            }
        });
    }

    if (tBloom) {
        tBloom.checked = pipeline.bloomEnabled;
        tBloom.addEventListener("change", (e) => {
            pipeline.bloomEnabled = (e.target as HTMLInputElement).checked;
        });
    }

    // SSAO 2 and SSR have been completely removed to guarantee 60+ FPS on all devices.
    // The game will still look excellent with just the HDRI skybox and Bloom!

    return { scene, playerEid, engine };
}

async function startGame(engine: Engine | WebGPUEngine, canvas: HTMLCanvasElement, username: string, mapChoice: string = "original") {
    try {
        const { scene, playerEid } = await createScene(engine, canvas, mapChoice);
        activeScene = scene;

        // Network Setup
        const multiplayerEntities = new MultiplayerEntities(scene);
        const networkManager = new NetworkManager(username, () => {
        });

        const weaponSystem = new WeaponSystem(scene, playerEid, networkManager);
        await weaponSystem.init();

        let isLocalDead = false;
        let respawnTimerActive = false;

        networkManager.onStateReceived = (globalState) => {
            multiplayerEntities.updateNetworkState(globalState, username);
            
            // Update local health UI
            const myState = globalState[username];
            if (myState) {
                const hpText = document.getElementById("healthText");
                const hpBar = document.getElementById("healthBar");
                if (hpText && hpBar) {
                    hpText.innerText = `${myState.health} HP`;
                    hpBar.style.width = `${myState.health}%`;
                }

                // Handle Death State
                const deathScreen = document.getElementById("deathScreen");
                if (myState.isDead && !isLocalDead) {
                    isLocalDead = true;
                    if (deathScreen) deathScreen.style.display = "flex";
                    
                    // Exit pointer lock
                    document.exitPointerLock();

                    if (!respawnTimerActive) {
                        respawnTimerActive = true;
                        let timeLeft = 3;
                        const timerSpan = document.getElementById("respawnTimer");
                        const interval = setInterval(() => {
                            timeLeft--;
                            if (timerSpan) timerSpan.innerText = timeLeft.toString();
                            if (timeLeft <= 0) {
                                clearInterval(interval);
                                networkManager.sendRespawnRequest();
                            }
                        }, 1000);
                    }
                } else if (!myState.isDead && isLocalDead) {
                    // Server updated our state to alive, trigger respawn
                    networkManager.onRespawn(myState.x, myState.y, myState.z);
                }
            }

            // Sync Scoreboard
            const scoreboardBody = document.getElementById("scoreboardBody");
            if (scoreboardBody) {
                let html = "";
                const sortedPlayers = Object.entries(globalState).sort((a, b) => (b[1].kills || 0) - (a[1].kills || 0) || a[0].localeCompare(b[0]));
                for (const [id, p] of sortedPlayers) {
                    html += `
                        <tr style="border-bottom: 1px solid #444; color: ${p.isDead ? '#ff4444' : 'white'}">
                            <td style="padding: 8px;">${id === username ? id + ' (You)' : id} ${p.isDead ? '(DEAD)' : ''}</td>
                            <td style="padding: 8px;">${p.kills || 0}</td>
                            <td style="padding: 8px;">${p.deaths || 0}</td>
                            <td style="padding: 8px; color: #4ade80;">12ms</td>
                        </tr>
                    `;
                }
                scoreboardBody.innerHTML = html;
            }
        };

        networkManager.onRespawn = () => {
            isLocalDead = false;
            respawnTimerActive = false;
            
            const deathScreen = document.getElementById("deathScreen");
            if (deathScreen) deathScreen.style.display = "none";
            const timerSpan = document.getElementById("respawnTimer");
            if (timerSpan) timerSpan.innerText = "3";

            // Teleport back to spawn
            const mesh = entityMeshes.get(playerEid);
            const body = entityPhysicsBodies.get(playerEid);
            if (mesh && body) {
                const rx = (Math.random() - 0.5) * 20;
                const rz = (Math.random() - 0.5) * 20;
                
                // For Havok, we need to disable physics, move mesh, re-enable. But setting velocity to 0 and position on transformNode works if we use disablePreStep
                mesh.position.set(rx, 5, rz);
                body.setLinearVelocity(Vector3.Zero());
            }
        };

        networkManager.onFireReceived = (shooterId) => {
            multiplayerEntities.triggerFire(shooterId);
        };

        // Network Tick Loop (60Hz for smoother interpolation)
        let networkTickTimer = 0;
        const _tempPos = new Vector3();
        const _tempRot = new Quaternion();
        
        scene.onBeforeRenderObservable.add(() => {
            if (isLocalDead) return;
            
            const dt = engine.getDeltaTime();

            // Run ECS Systems
            playerMovementSystem(dt / 1000, scene);
            PhysicsSystem(world);

            networkTickTimer += dt;
            if (networkTickTimer >= 1000 / 60) {
                networkTickTimer = 0;
                
                const mesh = entityMeshes.get(playerEid);
                const camera = entityCameras.get(playerEid);
                
                if (mesh && camera) {
                    const yaw = camera.rotation.y;
                    Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, _tempRot);
                    
                    const eid = playerEid;
                    let anim = "idle";
                    if (PlayerComponent.isGrounded[eid] === 0) {
                        anim = "jump";
                    } else if (InputComponent.forward[eid] || InputComponent.backward[eid]) {
                        anim = "run";
                    } else if (InputComponent.left[eid]) {
                        anim = "right";
                    } else if (InputComponent.right[eid]) {
                        anim = "left";
                    }

                    _tempPos.set(Position.x[eid], Position.y[eid], Position.z[eid]);
                    
                    let platformId: string | undefined = undefined;
                    if (PlayerComponent.isGrounded[eid]) {
                        const ray = new Ray(_tempPos, Vector3.Down(), 1.5);
                        // Generalistic platform detection: works with any mesh named 'elevator', 'platform', or 'moving' in your GLB
                        const hit = scene.pickWithRay(ray, (mesh) => 
                            mesh.name.toLowerCase().includes("elevator") || 
                            mesh.name.toLowerCase().includes("platform") || 
                            mesh.name.toLowerCase().includes("moving")
                        );
                        if (hit?.hit && hit.pickedMesh) {
                            platformId = hit.pickedMesh.name;
                            const invWorld = hit.pickedMesh.getWorldMatrix().clone().invert();
                            Vector3.TransformCoordinatesToRef(_tempPos, invWorld, _tempPos);
                        }
                    }

                    networkManager.sendState(
                        _tempPos,
                        _tempRot,
                        anim,
                        platformId
                    );
                }
            }
        });

        // UI and Pointer Lock
        let isLocked = false;
        const pointerWarning = document.getElementById("pointerWarning");
        
        canvas.addEventListener("click", () => {
            if (!isLocked && !isLocalDead) {
                engine.enterPointerlock();
            }
        });

        document.addEventListener("pointerlockchange", () => {
            if (document.pointerLockElement === canvas) {
                isLocked = true;
                if (pointerWarning) pointerWarning.style.display = "none";
            } else {
                isLocked = false;
                if (pointerWarning) pointerWarning.style.display = "block";
            }
        });

        // Scoreboard (TAB)
        const scoreboard = document.getElementById("scoreboardUI");
        const scoreboardBody = document.getElementById("scoreboardBody");
        const engineIndicator = document.getElementById("engineTypeIndicator");
        
        window.addEventListener("keydown", (e) => {
            if (e.code === "Tab") {
                e.preventDefault();
                if (e.repeat) return;
                if (scoreboard && scoreboardBody) {
                    scoreboard.style.display = "block";
                    
                    if (engineIndicator) {
                        engineIndicator.innerText = currentEngineType;
                        engineIndicator.style.color = currentEngineType === "WebGPU" ? "#00FF00" : "#FFA500";
                    }
                }
            }
        });
        
        window.addEventListener("keyup", (e) => {
            if (e.code === "Tab" && scoreboard) {
                e.preventDefault();
                scoreboard.style.display = "none";
            }
        });

    } catch (e: any) {
        console.error("Failed to initialize game scene.", e);
        throw e;
    }
}

// Global Initialization
const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
if (canvas) {
    initEngine(canvas).then((engine) => {
        const mainMenu = new MainMenuScene(engine);
        activeScene = mainMenu.scene;

        engine.runRenderLoop(() => {
            if (activeScene) activeScene.render();
        });

        window.addEventListener("resize", () => {
            engine.resize();
        });

        const joinBtn = document.getElementById("joinButton") as HTMLButtonElement;
        const loginUI = document.getElementById("loginUI");
        const usernameInput = document.getElementById("usernameInput") as HTMLInputElement;

        if (joinBtn && loginUI && usernameInput) {
            joinBtn.disabled = false;
            joinBtn.innerHTML = `<span class="btn-text">DEPLOY TO COMBAT</span><div class="btn-glow"></div>`;

            joinBtn.addEventListener("click", () => {
                let username = usernameInput.value.trim();
                if (!username) {
                    username = "Guest_" + Math.floor(Math.random() * 1000);
                }
                let mapChoice = "original";
                const mapSelector = document.getElementById("mapSelector") as HTMLSelectElement;
                if (mapSelector) {
                    mapChoice = mapSelector.value;
                }
                joinBtn.disabled = true; // Prevent double click
                joinBtn.innerHTML = `<span class="btn-text">LOADING ENVIRONMENT...</span><div class="btn-glow"></div>`;
                
                // Do not dispose the main menu yet! We want to keep rendering it while the new scene loads asynchronously in the background.
                startGame(engine, canvas, username, mapChoice).then(() => {
                    // Once fully loaded, hide the UI and dispose the menu
                    loginUI.style.display = "none";
                    mainMenu.dispose();
                }).catch(err => {
                    joinBtn.disabled = false;
                    joinBtn.innerHTML = `<span class="btn-text">DEPLOY TO COMBAT</span><div class="btn-glow"></div>`;
                    const errorLog = document.getElementById("errorLog");
                    if (errorLog) errorLog.innerText = "Error loading map: " + (err.message || err);
                });
            });
        }
    }).catch(e => {
        console.error("Failed to initialize Engine.", e);
        document.body.innerHTML = `<div style="color:white; padding: 20px; font-family: monospace;">
            <h2 style="color:red;">Engine failed to initialize.</h2>
            <pre style="background:#222; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word;">${e.stack || e.message || e}</pre>
        </div>`;
    });
}
