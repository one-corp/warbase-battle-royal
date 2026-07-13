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
    WebGPUEngine
} from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import "@babylonjs/loaders/glTF"; 
import { EnvironmentManager } from './engine/Environment';
import { PlayerController } from './physics/PlayerController';
import { WeaponSystem } from './physics/WeaponSystem';
import { NetworkManager } from "./network/NetworkManager";
import { MultiplayerEntities } from "./network/MultiplayerEntities";
import { initBuildingTemplates } from "./engine/BuildingGenerator";

export let currentEngineType = "WebGL 2.0";

async function initEngine(canvas: HTMLCanvasElement): Promise<Engine | WebGPUEngine> {
    const webgpuSupported = await WebGPUEngine.IsSupportedAsync;
    if (webgpuSupported) {
        try {
            const engine = new WebGPUEngine(canvas);
            await engine.initAsync();
            currentEngineType = "WebGPU";
            return engine;
        } catch (e) {
            console.warn("WebGPU initialization failed, falling back to WebGL", e);
        }
    } else {
        console.warn("WebGPU not supported by this browser, falling back to WebGL 2.0");
    }
    
    currentEngineType = "WebGL 2.0";
    return new Engine(canvas, true);
}

async function createScene(engine: Engine | WebGPUEngine, canvas: HTMLCanvasElement) {
    const scene = new Scene(engine);
    
    scene.collisionsEnabled = true;
    scene.gravity = new Vector3(0, -9.81, 0);

    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.81, 0), hk);

    // 1. Image Based Lighting & Skybox
    const envTexture = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/Runyon_Canyon_A_2k_cube_specular.env", scene);
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

    initBuildingTemplates(scene, shadowGenerator);
    
    new EnvironmentManager(scene, shadowGenerator);
    const playerController = new PlayerController(scene, canvas, engine);

    // 3. Cinematic Post-Processing
    const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [playerController.camera]);
    pipeline.samples = 4; // MSAA
    pipeline.fxaaEnabled = true; // FXAA

    // Tone Mapping (ACES for realistic brights/darks)
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipeline.imageProcessing.exposure = 1.0;

    // Bloom
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.8;
    pipeline.bloomWeight = 0.3;

    return { scene, playerController, engine };
}

let globalStateRef: Record<string, any> = {};

async function startGame(username: string) {
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    if (!canvas) return;

    try {
        const engine = await initEngine(canvas);
        const { scene, playerController } = await createScene(engine, canvas);

        // Network Setup
        const multiplayerEntities = new MultiplayerEntities(scene);
        const networkManager = new NetworkManager(username, () => {
        });

        const weaponSystem = new WeaponSystem(scene, playerController, networkManager);
        await weaponSystem.init();

        let isLocalDead = false;
        let respawnTimerActive = false;

        networkManager.onStateReceived = (globalState) => {
            globalStateRef = globalState;
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
                scoreboardBody.innerHTML = "";
                for (const id in globalState) {
                    const p = globalState[id];
                    scoreboardBody.innerHTML += `
                        <tr style="border-bottom: 1px solid #444;">
                            <td style="padding: 8px;">${id === username ? id + ' (You)' : id}</td>
                            <td style="padding: 8px;">${p.kills || 0}</td>
                            <td style="padding: 8px;">${p.deaths || 0}</td>
                            <td style="padding: 8px; color: #4ade80;">12ms</td>
                        </tr>
                    `;
                }
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
            if (playerController.mesh && playerController.aggregate.body) {
                const rx = (Math.random() - 0.5) * 20;
                const rz = (Math.random() - 0.5) * 20;
                playerController.mesh.position.set(rx, 5, rz);
                playerController.aggregate.body.setLinearVelocity(Vector3.Zero());
            }
        };

        networkManager.onFireReceived = (shooterId) => {
            multiplayerEntities.triggerFire(shooterId);
        };

        // Network Tick Loop (60Hz for smoother interpolation)
        let networkTickTimer = 0;
        scene.onBeforeRenderObservable.add(() => {
            if (isLocalDead) return;
            
            networkTickTimer += engine.getDeltaTime();
            if (networkTickTimer >= 1000 / 60) {
                networkTickTimer = 0;
                
                if (playerController.mesh) {
                    const yaw = playerController.camera.rotation.y;
                    const rot = Quaternion.RotationYawPitchRoll(yaw, 0, 0);
                    
                    const input = playerController.input;
                    const state = playerController.state;
                    
                    let anim = "idle";
                    if (!state.isGrounded) {
                        anim = "jump";
                    } else if (input.forward || input.backward) {
                        anim = "run";
                    } else if (input.left) {
                        anim = "right";
                    } else if (input.right) {
                        anim = "left";
                    }

                    networkManager.sendState(playerController.mesh.position, rot, anim);
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
                if (scoreboard && scoreboardBody) {
                    scoreboard.style.display = "block";
                    
                    if (engineIndicator) {
                        engineIndicator.innerText = currentEngineType;
                        engineIndicator.style.color = currentEngineType === "WebGPU" ? "#00FF00" : "#FFA500";
                    }

                    let html = "";
                    for (const id in globalStateRef) {
                        const p = globalStateRef[id];
                        html += `
                        <tr style="border-bottom: 1px solid #444; color: ${p.isDead ? '#ff4444' : 'white'}">
                            <td style="padding: 10px;">${id} ${p.isDead ? '(DEAD)' : ''}</td>
                            <td style="padding: 10px;">${p.kills || 0}</td>
                            <td style="padding: 10px;">${p.deaths || 0}</td>
                            <td style="padding: 10px;">0ms</td>
                        </tr>`;
                    }
                    scoreboardBody.innerHTML = html;
                }
            }
        });
        
        window.addEventListener("keyup", (e) => {
            if (e.code === "Tab" && scoreboard) {
                e.preventDefault();
                scoreboard.style.display = "none";
            }
        });

        engine.runRenderLoop(() => {
            scene.render();
        });

        window.addEventListener("resize", () => {
            engine.resize();
        });

    } catch (e: any) {
        console.error("Failed to initialize Engine.", e);
        document.body.innerHTML = `<div style="color:white; padding: 20px; font-family: monospace;">
            <h2 style="color:red;">Engine failed to initialize.</h2>
            <pre style="background:#222; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word;">${e.stack || e.message || e}</pre>
        </div>`;
    }
}

const joinBtn = document.getElementById("joinButton") as HTMLButtonElement;
const loginUI = document.getElementById("loginUI");
const usernameInput = document.getElementById("usernameInput") as HTMLInputElement;

if (joinBtn && loginUI && usernameInput) {
    joinBtn.disabled = false;
    joinBtn.innerText = "Join Game";
    joinBtn.style.background = "#28a745";
    joinBtn.style.cursor = "pointer";

    joinBtn.addEventListener("click", () => {
        let username = usernameInput.value.trim();
        if (!username) {
            username = "Guest_" + Math.floor(Math.random() * 1000);
        }
        loginUI.style.display = "none";
        startGame(username);
    });
} else {
    startGame("Guest");
}
