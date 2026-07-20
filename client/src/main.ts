import './ui/style.css';
import {
    Scene,
    Vector3,
    DirectionalLight,
    Engine,
    HavokPlugin,
    Quaternion,
    CubeTexture,
    ShadowGenerator,
    DefaultRenderingPipeline,
    ImageProcessingConfiguration,
    WebGPUEngine,
    Ray,
    SceneInstrumentation,
    EngineInstrumentation,
    SSAO2RenderingPipeline,
    ScreenSpaceReflectionPostProcess
} from '@babylonjs/core';
import '@babylonjs/core/Engines/WebGPU/Extensions/index.js';
import HavokPhysics from '@babylonjs/havok';
import './ui/style.css';
import "@babylonjs/loaders/glTF"; 
import { EnvironmentManager } from './engine/Environment';
import { initPlayer } from './ecs/systems/PlayerSystem';
import { playerMovementSystem } from './ecs/systems/PlayerMovementSystem';
import { updateTracers } from './ecs/systems/TracerSystem';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { InputComponent, PlayerComponent, Position } from './ecs/Components';
import { entityCameras, entityMeshes, entityPhysicsBodies } from './ecs/ViewMaps';
import { world } from './ecs/World';
import { initWeapons, createWeaponSystem } from './physics/WeaponSystem';
import { throwNetworkGrenade } from './physics/GrenadeSystem';
import { NetworkManager } from "./network/NetworkManager";
import { MultiplayerEntities } from "./network/MultiplayerEntities";

import { MainMenuScene } from "./engine/MainMenuScene";

export let currentEngineType = "WebGL 2.0";
export let activeScene: Scene | null = null;

async function initEngine(canvas: HTMLCanvasElement): Promise<Engine | WebGPUEngine> {
    const forceWebGL = localStorage.getItem("forceWebGL") === "true";

    if (!forceWebGL && await WebGPUEngine.IsSupportedAsync) {
        let engine;
        try {
            engine = new WebGPUEngine(canvas, { antialias: false, enableGPUDebugMarkers: true });
            await engine.initAsync();
            currentEngineType = "WebGPU";
            return engine;
        } catch (e) {
            console.error("WebGPU initialization failed:", e);
            const errorElement = document.getElementById("errorDisplay");
            if (errorElement) errorElement.innerText = "Error: WebGPU failed to initialize. Please check your browser compatibility.";
        }
    } else if (!forceWebGL) {
        console.warn("WebGPU not supported by this browser, falling back to WebGL 2.0");
    }
    
    currentEngineType = "WebGL 2.0";
    return new Engine(canvas, true);
}

async function createScene(engine: Engine | WebGPUEngine, canvas: HTMLCanvasElement, mapChoice: string) {
    const scene = new Scene(engine);
    
    scene.collisionsEnabled = true;
    // Standard 9.81 gravity feels too floaty in FPS games. 
    // Increasing gravity to 15.3 makes jumps 20% faster while we scale impulse to match height.
    scene.gravity = new Vector3(0, -15.328, 0);

    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -15.328, 0), hk);

    // 1. Image Based Lighting & Skybox (Switched to standard neutral environment)
    const envTexture = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/environment.env", scene);
    scene.environmentTexture = envTexture;
    let currentSkybox = scene.createDefaultSkybox(envTexture, true, 1000, 0.3);

    // 2. Realistic Sun Lighting & Cascaded Shadows
    const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
    sun.position = new Vector3(20, 40, 20);
    sun.intensity = 2.0;

    const useUltraShadows = localStorage.getItem("optUltraShadows") === "true";
    const shadowMapSize = useUltraShadows ? 4096 : 2048;
    const shadowGenerator = new ShadowGenerator(shadowMapSize, sun);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    if (useUltraShadows) {
        shadowGenerator.usePercentageCloserFiltering = true;
    }
    shadowGenerator.enableSoftTransparentShadow = true;
    shadowGenerator.setDarkness(0.5);
    
    const envManager = new EnvironmentManager(scene, shadowGenerator, mapChoice);
    await envManager.init();
    const playerEid = initPlayer(scene, canvas);
    const camera = entityCameras.get(playerEid);
    
    // Explicitly enforce the player camera as the active camera (in case a GLB somehow overrode it)
    if (camera) scene.activeCamera = camera;

    // 3. Cinematic Post-Processing Pipeline
    const pipeline = new DefaultRenderingPipeline("defaultPipeline", false, scene, camera ? [camera] : []);
    pipeline.samples = 1; // Explicitly avoid MSAA
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = false;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.toneMappingEnabled = true;
    pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;

    // CRITICAL FIX: WebGPU requires the scene to be fully compiled.
    // We MUST await scene.whenReadyAsync() AFTER adding all materials and pipelines!
    await scene.whenReadyAsync();

    // --- Graphics UI Hookup ---
    const tChromatic = document.getElementById("toggleChromatic") as HTMLInputElement;
    if (tChromatic) {
        tChromatic.checked = pipeline.chromaticAberrationEnabled;
        tChromatic.addEventListener("change", (e) => {
            pipeline.chromaticAberrationEnabled = (e.target as HTMLInputElement).checked;
            if (pipeline.chromaticAberrationEnabled && pipeline.chromaticAberration) {
                pipeline.chromaticAberration.aberrationAmount = 30.0;
                pipeline.chromaticAberration.radialIntensity = 1.0;
            }
        });
        
        let ssaoPipeline: any = null;
        let ssrPipeline: any = null;

        const syncProGraphics = () => {
            const useMSAA = localStorage.getItem("optMSAA") === "true";
            const useSSAO = localStorage.getItem("optSSAO") === "true";
            const useSSR = localStorage.getItem("optSSR") === "true";
            
            pipeline.samples = useMSAA ? 4 : 1;

            if (useSSAO && !ssaoPipeline) {
                ssaoPipeline = new SSAO2RenderingPipeline("ssao", scene, {
                    ssaoRatio: 0.5,
                    blurRatio: 1.0
                });
                ssaoPipeline.radius = 1.2;
                ssaoPipeline.totalStrength = 1.0;
                if (camera) scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);
            } else if (!useSSAO && ssaoPipeline) {
                ssaoPipeline.dispose();
                ssaoPipeline = null;
            }

            if (useSSR && !ssrPipeline) {
                ssrPipeline = new ScreenSpaceReflectionPostProcess("ssr", scene, 1.0, camera!);
                ssrPipeline.step = 2.0;
            } else if (!useSSR && ssrPipeline) {
                ssrPipeline.dispose();
                ssrPipeline = null;
            }
        };

        ['optSSAO', 'optSSR', 'optMSAA', 'optUltraShadows', 'optChromatic'].forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement;
            if (el) {
                el.checked = localStorage.getItem(id) === "true";
                el.addEventListener('change', () => {
                    localStorage.setItem(id, el.checked ? "true" : "false");
                    if (id === 'optChromatic') {
                        pipeline.chromaticAberrationEnabled = el.checked;
                    } else if (id !== 'optUltraShadows') {
                        syncProGraphics();
                    }
                });
            }
        });
        
        syncProGraphics();
        pipeline.chromaticAberrationEnabled = localStorage.getItem("optChromatic") === "true";
    }


    const tSkybox = document.getElementById("skyboxSelector") as HTMLSelectElement;
    if (tSkybox) {
        tSkybox.addEventListener("change", (e) => {
            const envName = (e.target as HTMLSelectElement).value;
            const newEnvTexture = CubeTexture.CreateFromPrefilteredData(`https://playground.babylonjs.com/textures/${envName}`, scene);
            scene.environmentTexture = newEnvTexture;
            if (currentSkybox) {
                currentSkybox.dispose();
            }
            currentSkybox = scene.createDefaultSkybox(newEnvTexture, true, 1000, 0.3);
        });
    }
    // SSAO 2 and SSR have been completely removed to guarantee 60+ FPS on all devices.
    // The game will still look excellent with just the HDRI skybox and Bloom!

    return { scene, playerEid, engine };
}

async function startGame(engine: Engine | WebGPUEngine, canvas: HTMLCanvasElement, username: string, mapChoice: string = "original", roomId: string) {
    try {
        const { scene, playerEid } = await createScene(engine, canvas, mapChoice);
        activeScene = scene;

        // Network Setup
        const multiplayerEntities = new MultiplayerEntities(scene);
        const networkManager = new NetworkManager(username, roomId, () => {
        });

        await initWeapons(playerEid, scene, networkManager);
        const updateWeaponSystem = createWeaponSystem(scene, networkManager);

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
                const basePos = (window as any).SPAWN_POINT || new Vector3(0, 20, 0);
                const rx = basePos.x + (Math.random() - 0.5) * 4;
                const rz = basePos.z + (Math.random() - 0.5) * 4;
                
                // For Havok, we need to disable physics, move mesh, re-enable. But setting velocity to 0 and position on transformNode works if we use disablePreStep
                mesh.position.set(rx, basePos.y, rz);
                body.setLinearVelocity(Vector3.Zero());
            }
        };

        networkManager.onFireReceived = (shooterId) => {
            multiplayerEntities.triggerFire(shooterId);
        };

        networkManager.onGrenadeReceived = (_shooterId, px, py, pz, vx, vy, vz) => {
            // We ignore who threw it for now, and just spawn it at the location
            throwNetworkGrenade(scene, new Vector3(px, py, pz), new Vector3(vx, vy, vz));
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
            updateWeaponSystem(world, dt / 1000);
            updateTracers(dt / 1000);
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
                    } else if (InputComponent.backward[eid]) {
                        anim = "walking backwards";
                    } else if (InputComponent.forward[eid]) {
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
                    document.exitPointerLock();
                    if (engineIndicator) {
                        engineIndicator.innerText = currentEngineType;
                        engineIndicator.style.color = currentEngineType === "WebGPU" ? "#00FF00" : "#FFA500";
                    }
                }
            }
        });

        window.addEventListener("keyup", (e) => {
            if (e.code === "Tab") {
                if (scoreboard) {
                    scoreboard.style.display = "none";
                }
            }
        });

        // Engine Select Logic
        const engineSelector = document.getElementById("engineSelector") as HTMLSelectElement;
        if (engineSelector) {
            engineSelector.value = localStorage.getItem("forceWebGL") === "true" ? "webgl" : "auto";
            engineSelector.addEventListener("change", (e) => {
                const val = (e.target as HTMLSelectElement).value;
                if (val === "webgl") {
                    localStorage.setItem("forceWebGL", "true");
                } else {
                    localStorage.removeItem("forceWebGL");
                }
                // Reload to apply engine change
                window.location.reload();
            });
        }

        // Inspector/Metrics Toggle Logic
        const toggleInspectorBtn = document.getElementById("toggleInspectorBtn");
        const metricsPanel = document.getElementById("metricsPanel");
        const metricEngine = document.getElementById("metricEngine");
        if (metricEngine) metricEngine.innerText = currentEngineType;
        
        let showMetrics = false;
        if (toggleInspectorBtn && metricsPanel) {
            toggleInspectorBtn.addEventListener("click", () => {
                showMetrics = !showMetrics;
                metricsPanel.style.display = showMetrics ? "block" : "none";
            });
        }
        
        // Initialize Instrumentation for Metrics
        const sceneInstr = new SceneInstrumentation(scene);
        sceneInstr.captureActiveMeshesEvaluationTime = true;
        sceneInstr.captureFrameTime = true;
        
        const engineInstr = new EngineInstrumentation(engine);
        engineInstr.captureGPUFrameTime = true;

        const metricFps = document.getElementById("metricFps");
        const metricCpu = document.getElementById("metricCpu");
        const metricGpu = document.getElementById("metricGpu");
        const metricRam = document.getElementById("metricRam");
        const metricDrawCalls = document.getElementById("metricDrawCalls");
        const metricMeshes = document.getElementById("metricMeshes");
        
        let metricsTimer = 0;

        scene.onBeforeRenderObservable.add(() => {
            if (showMetrics) {
                metricsTimer += engine.getDeltaTime();
                if (metricsTimer > 250) { // Update 4 times a second
                    metricsTimer = 0;
                    if (metricFps) metricFps.innerText = engine.getFps().toFixed(0);
                    
                    // CPU Frame Time and Percentage
                    const cpuTimeMs = sceneInstr.frameTimeCounter.current;
                    const fps = engine.getFps();
                    const cpuPercent = (cpuTimeMs * fps) / 10; // (ms * frames_per_sec) / 1000 * 100 = percent
                    if (metricCpu) metricCpu.innerText = `${cpuTimeMs.toFixed(1)} ms (${cpuPercent.toFixed(1)}%)`;
                    
                    // GPU Frame Time (Requires compatible browser/extension)
                    if (metricGpu) {
                        const gpuTimeNano = engineInstr.gpuFrameTimeCounter.current;
                        if (gpuTimeNano > 0) {
                            const gpuTimeMs = gpuTimeNano / 1000000;
                            const gpuPercent = (gpuTimeMs * fps) / 10;
                            metricGpu.innerText = `${gpuTimeMs.toFixed(1)} ms (${gpuPercent.toFixed(1)}%)`;
                        } else {
                            metricGpu.innerText = "N/A (Blocked by Browser)"; 
                        }
                    }
                    
                    // RAM (Chrome/Edge only)
                    if (metricRam) {
                        const perf = window.performance as any;
                        if (perf && perf.memory) {
                            metricRam.innerText = (perf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(0);
                        } else {
                            metricRam.innerText = "N/A";
                        }
                    }

                    if (metricDrawCalls) metricDrawCalls.innerText = sceneInstr.drawCallsCounter.current.toString();
                    if (metricMeshes) metricMeshes.innerText = scene.getActiveMeshes().length.toString();
                }
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

        // Frame limiter variables
        const TARGET_FPS = 140;
        const MIN_FRAME_TIME = 1000 / TARGET_FPS;
        let lastRenderTime = performance.now();

        engine.runRenderLoop(() => {
            const now = performance.now();
            const dt = now - lastRenderTime;

            if (dt < MIN_FRAME_TIME) return;

            lastRenderTime = now;

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
                if (!username || username.toLowerCase() === "guest") {
                    username = "Guest_" + Math.floor(Math.random() * 10000);
                    usernameInput.value = username;
                }
                
                const roomIdInput = document.getElementById("selectedRoomId") as HTMLInputElement;
                const mapInput = document.getElementById("selectedMap") as HTMLInputElement;
                
                let roomId = roomIdInput ? roomIdInput.value : "";
                let mapChoice = mapInput ? mapInput.value : "original";
                
                if (!roomId) {
                    alert("Please select a server or create a match first.");
                    return;
                }
                
                joinBtn.disabled = true; // Prevent double click
                joinBtn.innerHTML = `<span class="btn-text">LOADING ENVIRONMENT...</span><div class="btn-glow"></div>`;
                
                // Do not dispose the main menu yet! We want to keep rendering it while the new scene loads asynchronously in the background.
                startGame(engine, canvas, username, mapChoice, roomId).then(() => {
                    // Once fully loaded, hide the UI and dispose the menu
                    loginUI.style.display = "none";
                    const uiLayer = document.getElementById("uiLayer");
                    if (uiLayer) uiLayer.style.display = "flex";
                    if ((window as any).mainMenu) {
                        (window as any).mainMenu.dispose();
                    }
                }).catch(err => {
                    joinBtn.disabled = false;
                    joinBtn.innerHTML = `<span class="btn-text">JOIN MATCH</span><div class="btn-glow"></div>`;
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
