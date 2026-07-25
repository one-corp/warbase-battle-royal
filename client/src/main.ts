import './ui/style.css';
import {
    Scene,
    Vector3,
    DirectionalLight,
    HemisphericLight,
    Engine,
    HavokPlugin,
    Quaternion,
    CubeTexture,
    ShadowGenerator,
    DefaultRenderingPipeline,
    WebGPUEngine,
    Ray,
    SceneInstrumentation,
    EngineInstrumentation,
    SSAO2RenderingPipeline,
    ScreenSpaceReflectionPostProcess,
    AbstractMesh,
    Texture,
    Color3
} from '@babylonjs/core';
import '@babylonjs/core/Engines/WebGPU/Extensions/index.js';
import HavokPhysics from '@babylonjs/havok';

import "@babylonjs/loaders/glTF"; 
import { EnvironmentManager } from './engine/Environment';
import { initPlayer } from './ecs/systems/PlayerSystem';
import { playerMovementSystem } from './ecs/systems/PlayerMovementSystem';
import { updateTracers } from './ecs/systems/TracerSystem';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { InputComponent, PlayerComponent, Position } from './ecs/Components';
import { entityCameras, entityMeshes, entityPhysicsBodies, clearAllViewMaps } from './ecs/ViewMaps';
import { world, clearECSWorld } from './ecs/World';
import { initWeapons, createWeaponSystem } from './physics/WeaponSystem';
import { throwNetworkGrenade } from './physics/GrenadeSystem';
import { NetworkManager } from "./network/NetworkManager";
import { MultiplayerEntities } from "./network/MultiplayerEntities";
import { ScopeUI } from "./ui/ScopeUI";

import { MainMenuScene } from "./engine/MainMenuScene";

export let currentEngineType = "WebGL 2.0";
export let activeScene: Scene | null = null;

function applySkyboxPreset(scene: Scene, presetName: string, oldSkybox?: AbstractMesh | null): AbstractMesh {
    if (oldSkybox) {
        try { oldSkybox.dispose(); } catch (e) {}
    }

    const isPBR = presetName.endsWith(".env");
    let texture: Texture | CubeTexture;
    
    if (isPBR) {
        texture = CubeTexture.CreateFromPrefilteredData(`https://playground.babylonjs.com/textures/${presetName}`, scene);
    } else {
        texture = new CubeTexture(`https://playground.babylonjs.com/textures/${presetName}`, scene);
    }

    // createDefaultSkybox: (texture, pbr, scale, blur, setGlobalEnvTexture)
    // If not PBR, use standard material skybox (pbr=false) so pure 6-sided textures work perfectly without blur.
    const newSkybox = scene.createDefaultSkybox(texture, isPBR, 1000, 0, false)!;
    
    // glTF/GLB models ALWAYS use PBR materials, which strictly require an environmentTexture.
    // Without this, the shadows on the map are 100% black because standard HemisphericLights don't work on PBR ambient.
    try {
        const pbrLightingEnv = CubeTexture.CreateFromPrefilteredData("https://playground.babylonjs.com/textures/country.env", scene);
        scene.environmentTexture = pbrLightingEnv;
        scene.environmentIntensity = 1.0; // Normalized ambient lighting
    } catch (e) {
        console.warn("Failed to load lighting env");
    }

    return newSkybox;
}

async function initEngine(canvas: HTMLCanvasElement): Promise<Engine | WebGPUEngine> {
    const forceWebGL = localStorage.getItem("forceWebGL") === "true";

    if (!forceWebGL && await WebGPUEngine.IsSupportedAsync) {
        let engine;
        try {
            engine = new WebGPUEngine(canvas, { antialias: false });
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

function setLoadingStatus(text: string) {
    const el = document.getElementById("btn-deploy-text");
    if (el) el.innerText = text;
    console.log(`[LOADING] ${text}`);
}

async function createScene(engine: Engine | WebGPUEngine, canvas: HTMLCanvasElement, mapChoice: string) {
    const scene = new Scene(engine);
    setLoadingStatus("INITIALIZING SCENE...");
    
    scene.collisionsEnabled = true;
    // Standard 9.81 gravity feels too floaty in FPS games. 
    // Increasing gravity to 15.3 makes jumps 20% faster while we scale impulse to match height.
    scene.gravity = new Vector3(0, -15.328, 0);

    setLoadingStatus("LOADING PHYSICS ENGINE...");
    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -15.328, 0), hk);
    setLoadingStatus("PHYSICS READY");

    // Initialize decoupled Scope UI Overlay
    ScopeUI.init();

    // 1. Image Based Lighting & Dynamic Multi-Skybox Setup
    const selectedSkybox = localStorage.getItem("optSkybox") || "TropicalSunnyDay";
    let currentSkybox: AbstractMesh | null = applySkyboxPreset(scene, selectedSkybox);

    // 2. Realistic Sun Lighting & Cascaded Shadows
    const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
    sun.position = new Vector3(20, 40, 20);
    sun.intensity = 2.0;

    const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.5; // Soft ambient fill light to fix pitch black shadows
    hemiLight.specular = new Color3(0, 0, 0); // No shiny specular from ambient light

    const shadowMapSize = 2048;
    const shadowGenerator = new ShadowGenerator(shadowMapSize, sun);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;
    shadowGenerator.enableSoftTransparentShadow = true;
    shadowGenerator.setDarkness(0.5);
    
    setLoadingStatus("LOADING MAP...");
    const envManager = new EnvironmentManager(scene, shadowGenerator, mapChoice);
    await envManager.init();
    setLoadingStatus("SPAWNING PLAYER...");
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
    
    // Disabled ACES Tone Mapping for natural colors and brighter shadows
    pipeline.imageProcessing.toneMappingEnabled = false;
    
    // Normalized exposure back to default
    pipeline.imageProcessing.exposure = 1.0;

    // CRITICAL FIX: WebGPU requires the scene to be fully compiled.
    // We MUST await scene.whenReadyAsync() AFTER adding all materials and pipelines!
    // Added a 3-second timeout fallback to prevent hangs on WebGPU systems with slow shader compile times.
    setLoadingStatus("COMPILING SHADERS...");
    try {
        await Promise.race([
            scene.whenReadyAsync(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Shader compilation timed out")), 3000))
        ]);
        setLoadingStatus("SHADERS COMPILED");
    } catch (e) {
        console.warn("Shader compilation timeout/warning, proceeding anyway:", e);
        setLoadingStatus("SHADERS READY (FORCED)");
    }

    // --- Graphics UI Hookup ---
    let ssaoPipeline: any = null;
    let ssrPipeline: any = null;

    const syncProGraphics = () => {
        const useMSAA = localStorage.getItem("optMSAA") === "true";
        const useAnisotropic = localStorage.getItem("optAnisotropic") === "true";
        const useSSAO = localStorage.getItem("optSSAO") === "true";
        const useSSR = localStorage.getItem("optSSR") === "true";
        
        console.log("[GFX] syncProGraphics called:", { useMSAA, useAnisotropic, useSSAO, useSSR, cameraExists: !!camera });
        
        pipeline.samples = useMSAA ? 4 : 1;

        scene.textures.forEach(texture => {
            if ((texture as any).anisotropicFilteringLevel !== undefined) {
                (texture as any).anisotropicFilteringLevel = useAnisotropic ? 16 : 1;
            }
        });

        if (useSSAO && !ssaoPipeline) {
            try {
                if (!scene.prePassRenderer) {
                    scene.enablePrePassRenderer();
                    console.log("[GFX] PrePassRenderer enabled");
                }
                ssaoPipeline = new SSAO2RenderingPipeline("ssao", scene, {
                    ssaoRatio: 0.5,
                    blurRatio: 1.0
                }, camera ? [camera] : undefined);
                ssaoPipeline.radius = 1.2; // Back to normal
                ssaoPipeline.totalStrength = 1.0; // Back to normal
                ssaoPipeline.samples = 16;
                ssaoPipeline.maxZ = 250;
                console.log("[GFX] SSAO pipeline CREATED and attached.");
            } catch (e) {
                console.error("[GFX] SSAO CREATION FAILED:", e);
                ssaoPipeline = null;
            }
        } else if (!useSSAO && ssaoPipeline) {
            ssaoPipeline.dispose();
            ssaoPipeline = null;
            console.log("[GFX] SSAO pipeline disposed");
        }

        if (useSSR && !ssrPipeline) {
            try {
                ssrPipeline = new ScreenSpaceReflectionPostProcess("ssr", scene, 1.0, camera!);
                ssrPipeline.step = 1.0;
                ssrPipeline.strength = 1.5;
                ssrPipeline.reflectionSamples = 64;
                console.log("[GFX] SSR post-process CREATED");
            } catch (e) {
                console.error("[GFX] SSR CREATION FAILED:", e);
                ssrPipeline = null;
            }
        } else if (!useSSR && ssrPipeline) {
            ssrPipeline.dispose();
            ssrPipeline = null;
            console.log("[GFX] SSR disposed");
        }
    };

    ['optSSAO', 'optSSR', 'optMSAA', 'optAnisotropic', 'optChromatic'].forEach(id => {
        const el = document.getElementById(id) as HTMLInputElement;
        if (el) {
            el.checked = localStorage.getItem(id) === "true";
            el.addEventListener('change', () => {
                console.log(`[GFX] Toggle changed: ${id} = ${el.checked}`);
                localStorage.setItem(id, el.checked ? "true" : "false");
                if (id === 'optChromatic') {
                    pipeline.chromaticAberrationEnabled = el.checked;
                } else {
                    syncProGraphics();
                }
            });
        } else {
            console.warn(`[GFX] Checkbox #${id} NOT FOUND in DOM!`);
        }
    });
    
    syncProGraphics();
    pipeline.chromaticAberrationEnabled = localStorage.getItem("optChromatic") === "true";


    const tSkybox = document.getElementById("skyboxSelector") as HTMLSelectElement;
    if (tSkybox) {
        tSkybox.value = selectedSkybox;
        tSkybox.addEventListener("change", (e) => {
            const envName = (e.target as HTMLSelectElement).value;
            localStorage.setItem("optSkybox", envName);
            currentSkybox = applySkyboxPreset(scene, envName, currentSkybox);
        });
    }
    // Note: SSAO and SSR are enabled dynamically via syncProGraphics when selected in settings.

    return { scene, playerEid, engine };
}

async function startGame(engine: Engine | WebGPUEngine, canvas: HTMLCanvasElement, username: string, mapChoice: string = "original", roomId: string) {
    try {
        const { scene, playerEid } = await createScene(engine, canvas, mapChoice);

        setLoadingStatus("SCENE READY — CONNECTING...");

        activeScene = scene;

        // Network Setup
        const multiplayerEntities = new MultiplayerEntities(scene);
        
        let networkManager!: NetworkManager;
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out")), 10000);
            networkManager = new NetworkManager(
                username, 
                roomId, 
                () => {
                    clearTimeout(timeout);
                    resolve();
                },
                () => {
                    clearTimeout(timeout);
                    reject(new Error("Username already taken. Please try a different name."));
                }
            );
        });
        setLoadingStatus("CONNECTED — ENTERING COMBAT");

        // ESC to return to main menu (now with confirmation popup)
        const exitPopup = document.getElementById("exitPopup");
        const btnExitConfirm = document.getElementById("btnExitConfirm");
        const btnExitCancel = document.getElementById("btnExitCancel");

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (document.pointerLockElement === canvas) {
                    document.exitPointerLock();
                } else if (exitPopup) {
                    if (exitPopup.style.display === "flex") {
                        exitPopup.style.display = "none";
                        canvas.requestPointerLock();
                    } else if (!isLocalDead) {
                        const scoreboard = document.getElementById("scoreboardUI") || document.getElementById("scoreboard");
                        if (!scoreboard || scoreboard.style.display !== "flex") {
                            exitPopup.style.display = "flex";
                        }
                    }
                }
            }
        };
        window.addEventListener("keydown", handleEscape);
        
        if (btnExitConfirm) {
            btnExitConfirm.onclick = () => {
                if (exitPopup) exitPopup.style.display = "none";
                networkManager.disconnect();
                
                const uiLayer = document.getElementById("uiLayer");
                if (uiLayer) uiLayer.style.display = "none";
                
                const loginUI = document.getElementById("loginUI");
                if (loginUI) loginUI.style.display = "flex";
                
                const btnDeployText = document.getElementById("btn-deploy-text");
                if (btnDeployText) btnDeployText.innerText = "DEPLOY";
                
                const joinBtn = document.getElementById("joinButton") as HTMLButtonElement;
                if (joinBtn) joinBtn.disabled = false;
                
                window.removeEventListener("keydown", handleEscape);

                if (scene && (scene as any).cleanupEventListeners) {
                    (scene as any).cleanupEventListeners();
                }
                
                // CRITICAL: Clean up ECS and ViewMaps before destroying the scene
                clearECSWorld();
                clearAllViewMaps();
                
                scene.dispose();
                activeScene = null;
                
                const mainMenu = new MainMenuScene(engine as Engine);
                (window as any).mainMenu = mainMenu;
                activeScene = mainMenu.scene;
            };
        }
        
		if (btnExitCancel) {
			btnExitCancel.onclick = () => {
				if (exitPopup) exitPopup.style.display = "none";
				canvas.requestPointerLock();
			};
		}

		setLoadingStatus("DOWNLOADING WEAPONS & ANIMATIONS...");
		await initWeapons(playerEid, scene, networkManager);
		setLoadingStatus("ENTERING COMBAT...");
		
		const updateWeaponSystem = createWeaponSystem(scene, networkManager);

        let isLocalDead = false;
        let respawnTimerActive = false;
        let respawnInterval: any = null;

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
                        if (respawnInterval) clearInterval(respawnInterval);
                        respawnInterval = setInterval(() => {
                            timeLeft--;
                            if (timerSpan) timerSpan.innerText = timeLeft.toString();
                            if (timeLeft <= 0) {
                                if (respawnInterval) {
                                    clearInterval(respawnInterval);
                                    respawnInterval = null;
                                }
                                networkManager.sendRespawnRequest();
                            }
                        }, 1000);
                    }
                } else if (!myState.isDead && isLocalDead) {
                    // Server updated our state to alive, trigger respawn
                    networkManager.onRespawn(myState.x, myState.y, myState.z);
                }
            }

            // Sync Scoreboard (Optimized: Only update DOM if scoreboard is actually visible)
            const scoreboardUI = document.getElementById("scoreboardUI");
            if (scoreboardUI && scoreboardUI.style.display === "flex") {
                const scoreboardBody = document.getElementById("scoreboardBody");
                if (scoreboardBody) {
                    let html = "";
                    const sortedPlayers = Object.entries(globalState).sort((a, b) => (b[1].kills || 0) - (a[1].kills || 0) || a[0].localeCompare(b[0]));
                    
                    // Helper to prevent XSS
                    const escapeHTML = (str: string) => {
                        return str.replace(/[&<>'"]/g, tag => ({
                            '&': '&amp;',
                            '<': '&lt;',
                            '>': '&gt;',
                            "'": '&#39;',
                            '"': '&quot;'
                        }[tag] || tag));
                    };

                    for (const [id, p] of sortedPlayers) {
                        const safeId = escapeHTML(id);
                        html += `
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: ${p.isDead ? '#ff4444' : 'white'}">
                                <td style="padding: 10px; font-weight: 600;">${id === username ? safeId + ' <span style="color: #60a5fa;">(YOU)</span>' : safeId} ${p.isDead ? '<span style="color: #ff4444; font-size: 11px;">[DEAD]</span>' : ''}</td>
                                <td style="padding: 10px; text-align: center; color: #fff;">${p.kills || 0}</td>
                                <td style="padding: 10px; text-align: center; color: rgba(255,255,255,0.6);">${p.deaths || 0}</td>
                                <td style="padding: 10px; text-align: right; color: #4ade80; font-family: 'Share Tech Mono', monospace;">${p.ping || 0}ms</td>
                            </tr>
                        `;
                    }
                    scoreboardBody.innerHTML = html;
                }
            }
        };

        networkManager.onRespawn = (x?: number, y?: number, z?: number) => {
            isLocalDead = false;
            respawnTimerActive = false;
            if (respawnInterval) {
                clearInterval(respawnInterval);
                respawnInterval = null;
            }
            
            const deathScreen = document.getElementById("deathScreen");
            if (deathScreen) deathScreen.style.display = "none";
            const timerSpan = document.getElementById("respawnTimer");
            if (timerSpan) timerSpan.innerText = "3";
 
            // Teleport back to spawn
            const mesh = entityMeshes.get(playerEid);
            const body = entityPhysicsBodies.get(playerEid);
            if (mesh && body) {
                if (x !== undefined && y !== undefined && z !== undefined) {
                    mesh.position.set(x, y, z);
                } else {
                    const basePos = (window as any).SPAWN_POINT || new Vector3(0, 20, 0);
                    const rx = basePos.x + (Math.random() - 0.5) * 4;
                    const rz = basePos.z + (Math.random() - 0.5) * 4;
                    mesh.position.set(rx, basePos.y, rz);
                }
                body.setLinearVelocity(Vector3.Zero());
            }
        };

        networkManager.onFireReceived = (shooterId, ox, oy, oz, hx, hy, hz, nx, ny, nz, hitWall) => {
            const origin = (ox !== undefined && oy !== undefined && oz !== undefined) ? new Vector3(ox, oy, oz) : undefined;
            const hitPoint = (hx !== undefined && hy !== undefined && hz !== undefined) ? new Vector3(hx, hy, hz) : undefined;
            const normal = (nx !== undefined && ny !== undefined && nz !== undefined) ? new Vector3(nx, ny, nz) : undefined;
            multiplayerEntities.triggerFire(shooterId, origin, hitPoint, normal, hitWall);
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
        
        const handleCanvasClick = () => {
            if (!isLocked && !isLocalDead) {
                engine.enterPointerlock();
            }
        };
        canvas.addEventListener("click", handleCanvasClick);

        const handlePointerLockChange = () => {
            if (document.pointerLockElement === canvas) {
                isLocked = true;
                if (pointerWarning) pointerWarning.style.display = "none";
                if (exitPopup) exitPopup.style.display = "none";
            } else {
                isLocked = false;
                if (!isLocalDead) {
                    const scoreboard = document.getElementById("scoreboardUI") || document.getElementById("scoreboard");
                    if (!scoreboard || scoreboard.style.display !== "flex") {
                        if (exitPopup) exitPopup.style.display = "flex";
                        if (pointerWarning) pointerWarning.style.display = "none";
                    } else {
                        if (pointerWarning) pointerWarning.style.display = "block";
                    }
                } else {
                    if (pointerWarning) pointerWarning.style.display = "none";
                }
            }
        };
        document.addEventListener("pointerlockchange", handlePointerLockChange);

        // Scoreboard (TAB)
        const scoreboard = document.getElementById("scoreboardUI") || document.getElementById("scoreboard");
        const scoreboardBody = document.getElementById("scoreboardBody");
        const engineIndicator = document.getElementById("engineTypeIndicator");
        
        let isTabOpen = false;

        const handleTabDown = (e: KeyboardEvent) => {
            if (e.code === "Tab") {
                e.preventDefault();
                if (e.repeat) return;

                isTabOpen = !isTabOpen;

                if (scoreboard && scoreboardBody) {
                    if (isTabOpen) {
                        scoreboard.style.display = "flex"; // Show overlay
                        document.exitPointerLock();
                        if (engineIndicator) {
                            engineIndicator.innerText = (window as any).currentEngineType || "WebGPU";
                            engineIndicator.style.color = (window as any).currentEngineType === "WebGPU" ? "#00FF00" : "#FFA500";
                        }
                    } else {
                        scoreboard.style.display = "none"; // Hide overlay
                        canvas.requestPointerLock();
                    }
                }
            }
        };
        window.addEventListener("keydown", handleTabDown);

        // Store cleanup handles on the scene so they can be triggered from btnExitConfirm
        (scene as any).cleanupEventListeners = () => {
            window.removeEventListener("keydown", handleEscape);
            canvas.removeEventListener("click", handleCanvasClick);
            document.removeEventListener("pointerlockchange", handlePointerLockChange);
            window.removeEventListener("keydown", handleTabDown);
            if (respawnInterval) {
                clearInterval(respawnInterval);
                respawnInterval = null;
            }
        };

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
        (window as any).mainMenu = mainMenu; // Store on window for proper disposal
        activeScene = mainMenu.scene;

        // Frame limiter variables
        engine.runRenderLoop(() => {
            if (activeScene) activeScene.render();
        });

        window.addEventListener("resize", () => {
            engine.resize();
        });

        const joinBtn = document.getElementById("joinButton") as HTMLButtonElement;
        const loginUI = document.getElementById("loginUI");
        const usernameInput = document.getElementById("usernameInput") as HTMLInputElement;
        const btnDeployText = document.getElementById("btn-deploy-text");

        if (joinBtn && loginUI && usernameInput) {
            // Enable the deploy button once engine is ready
            joinBtn.disabled = false;
            joinBtn.style.opacity = "1";
            if (btnDeployText) btnDeployText.innerText = "DEPLOY";

            joinBtn.addEventListener("click", () => {
                console.log("=== JOIN BUTTON CLICKED IN MAIN.TS ===");
                let username = sessionStorage.getItem("warbase_player_name") || (usernameInput ? usernameInput.value.trim() : "");
                if (!username || username.toLowerCase() === "guest" || username.toLowerCase() === "callsign") {
                    username = "Operator_" + Math.floor(100 + Math.random() * 900);
                    sessionStorage.setItem("warbase_player_name", username);
                    if (usernameInput) usernameInput.value = username;
                }
                
                const roomIdInput = document.getElementById("selectedRoomId") as HTMLInputElement;
                const mapInput = document.getElementById("selectedMap") as HTMLInputElement;
                
                let roomId = roomIdInput ? roomIdInput.value : "";
                let mapChoice = mapInput ? mapInput.value : "original";
                
                console.log("Join inputs - username:", username, "roomId:", roomId, "mapChoice:", mapChoice);
                
                if (!roomId) {
                    console.error("Join blocked: roomId is empty!");
                    alert("Please select a match or create one first.");
                    return;
                }
                
                joinBtn.disabled = true;
                if (btnDeployText) btnDeployText.innerText = "LOADING ENVIRONMENT...";
                
                // Dispose the 3D menu scene EARLY to free GPU memory and avoid buffer conflicts
                // when the game scene loads the same GLB models
                if ((window as any).mainMenu) {
                    (window as any).mainMenu.dispose();
                    (window as any).mainMenu = null;
                    activeScene = null;
                }
                
                console.log("Starting game with roomId:", roomId);
                
                const restoreMenu = () => {
                    joinBtn.disabled = false;
                    if (btnDeployText) btnDeployText.innerText = "DEPLOY";
                    if (!(window as any).mainMenu) {
                        const mainMenu = new MainMenuScene(engine as Engine);
                        (window as any).mainMenu = mainMenu;
                        activeScene = mainMenu.scene;
                    }
                };

                // Add a timeout fallback in case the server never sends GameState (e.g. invalid room)
                let loadTimeout = setTimeout(() => {
                    if (window.getComputedStyle(loginUI).display !== "none") {
                        console.error("Game loading timed out! The server did not respond with game state.");
                        restoreMenu();
                    }
                }, 60000); // 60 second timeout

                startGame(engine, canvas, username, mapChoice, roomId).then(() => {
                    clearTimeout(loadTimeout);
                    console.log("Game successfully started, hiding login UI");
                    // Hide the menu overlay — canvas is now fully interactive
                    loginUI.style.display = "none";
                    const uiLayer = document.getElementById("uiLayer");
                    if (uiLayer) uiLayer.style.display = "flex";
                }).catch(err => {
                    clearTimeout(loadTimeout);
                    restoreMenu();
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
