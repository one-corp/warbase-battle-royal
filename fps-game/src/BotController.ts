import {
    Scene,
    Vector3,
    MeshBuilder,
    PhysicsAggregate,
    PhysicsShapeType,
    ShadowGenerator,
    SceneLoader
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF"; // Ensure GLTF loader is available

export async function setupBots(scene: Scene, shadowGenerator?: ShadowGenerator) {
    // Load the GLB asset container
    const container = await SceneLoader.LoadAssetContainerAsync("./models/", "AnimatedSoldier.glb", scene);
    
    // Create bots at specific locations
    createGlbBot(new Vector3(0, 5, 20), scene, container, shadowGenerator);
    createGlbBot(new Vector3(15, 5, 10), scene, container, shadowGenerator);
    createGlbBot(new Vector3(-15, 5, 15), scene, container, shadowGenerator);
}

function createGlbBot(
    position: Vector3, 
    scene: Scene, 
    container: any, 
    shadowGenerator?: ShadowGenerator
) {
    // 1. Physics Capsule (Invisible Root)
    const capsule = MeshBuilder.CreateCapsule("bot_capsule", { height: 1.8, radius: 0.4 }, scene);
    capsule.position = position.clone();
    capsule.isVisible = false;
    
    // Tag the capsule so weapon raycast knows it's an enemy
    capsule.metadata = { isEnemy: true, health: 100 };

    // Aggregate for collisions and getting hit
    const aggregate = new PhysicsAggregate(capsule, PhysicsShapeType.CAPSULE, { mass: 80, friction: 0.5, restitution: 0 }, scene);
    aggregate.body.setMassProperties({ inertia: Vector3.ZeroReadOnly });

    // 2. Instantiate Model
    const entries = container.instantiateModelsToScene();
    const rootNode = entries.rootNodes[0];
    
    rootNode.parent = capsule;
    rootNode.position = new Vector3(0, -0.9, 0); // Align feet to bottom of capsule
    
    // Face random direction
    capsule.rotation.y = Math.random() * Math.PI * 2;
    // Scale model (Soldier.glb might need scaling)
    rootNode.scaling = new Vector3(0.9, 0.9, 0.9); 

    // 3. Play Animation & Set up Blending
    const idleAnim = entries.animationGroups.find((ag: any) => ag.name.toLowerCase().includes("idle") || ag.name.toLowerCase().includes("tpose"));
    const walkAnim = entries.animationGroups.find((ag: any) => ag.name.toLowerCase().includes("walk") || ag.name.toLowerCase().includes("run"));
    
    if (idleAnim) {
        idleAnim.start(true);
        idleAnim.setWeightForAllAnimatables(1.0);
    }
    if (walkAnim) {
        walkAnim.start(true);
        walkAnim.setWeightForAllAnimatables(0.0);
    }

    // AI State Machine Variables
    let isWandering = false;
    let stateTimer = 0;
    let targetPosition = position.clone();
    const walkSpeed = 2.5;

    scene.onBeforeRenderObservable.add(() => {
        const dt = scene.getEngine().getDeltaTime() / 1000;
        stateTimer -= dt;

        // State Machine Logic
        if (stateTimer <= 0) {
            isWandering = !isWandering;
            if (isWandering) {
                // Pick random target within 15 units
                const randomX = (Math.random() - 0.5) * 30;
                const randomZ = (Math.random() - 0.5) * 30;
                targetPosition = new Vector3(position.x + randomX, capsule.position.y, position.z + randomZ);
                stateTimer = 2 + Math.random() * 4; // Wander for 2-6 seconds
            } else {
                stateTimer = 1 + Math.random() * 3; // Idle for 1-4 seconds
            }
        }

        // Movement & Rotation
        const currentVel = aggregate.body.getLinearVelocity();
        let targetVel = new Vector3(0, currentVel.y, 0); // maintain gravity

        if (isWandering) {
            const dir = targetPosition.subtract(capsule.position);
            dir.y = 0;
            const dist = dir.length();
            
            if (dist > 0.5) {
                dir.normalize();
                // Smooth Rotation
                const targetYaw = Math.atan2(dir.x, dir.z);
                
                // Determine shortest path for rotation
                let currentYaw = capsule.rotation.y;
                let diff = targetYaw - currentYaw;
                
                // Normalize diff to -PI to PI
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                
                capsule.rotation.y += diff * 5 * dt;

                // IMPORTANT FIX: Move strictly in the direction the bot is currently facing
                // rather than strafing instantly towards the target point.
                const forward = new Vector3(Math.sin(capsule.rotation.y), 0, Math.cos(capsule.rotation.y));
                targetVel.x = forward.x * walkSpeed;
                targetVel.z = forward.z * walkSpeed;
                
                // If we are rotating wildly (more than 45 degrees), slow down movement to turn
                if (Math.abs(diff) > Math.PI / 4) {
                    targetVel.x *= 0.2;
                    targetVel.z *= 0.2;
                }
            } else {
                // Reached destination early
                isWandering = false;
                stateTimer = 1 + Math.random() * 3;
            }
        }
        
        // Apply velocity (accelerate towards targetVel to avoid instant jerky starts)
        const newVelX = currentVel.x + (targetVel.x - currentVel.x) * 10 * dt;
        const newVelZ = currentVel.z + (targetVel.z - currentVel.z) * 10 * dt;
        aggregate.body.setLinearVelocity(new Vector3(newVelX, currentVel.y, newVelZ));

        // Animation Blending based on physical speed
        const currentSpeed = Math.sqrt(newVelX * newVelX + newVelZ * newVelZ);
        const walkWeight = Math.min(currentSpeed / walkSpeed, 1.0);
        
        if (idleAnim) idleAnim.setWeightForAllAnimatables(1.0 - walkWeight);
        if (walkAnim) walkAnim.setWeightForAllAnimatables(walkWeight);
    });

    // 4. Optimization & Shadows
    rootNode.getChildMeshes().forEach((mesh: any) => {
        mesh.alwaysSelectAsActiveMesh = true;
        if (shadowGenerator) {
            shadowGenerator.addShadowCaster(mesh, true);
        }
    });
}
