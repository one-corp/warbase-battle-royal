import {
    Scene,
    Vector3,
    MeshBuilder,
    StandardMaterial,
    Color3,
    PhysicsAggregate,
    PhysicsShapeType,
    ParticleSystem,
    Color4,
    Mesh,
    Texture
} from "@babylonjs/core";

const GRENADE_RADIUS = 0.1;
const GRENADE_FUSE = 3000; // ms
const EXPLOSION_RADIUS = 8;
const EXPLOSION_FORCE = 30;

export function throwNetworkGrenade(scene: Scene, position: Vector3, velocity: Vector3) {
    // 1. Create Grenade Mesh
    const grenade = MeshBuilder.CreateSphere("grenade", { diameter: GRENADE_RADIUS * 2 }, scene);
    
    // Spawn it at network provided position
    grenade.position.copyFrom(position);
    
    const mat = new StandardMaterial("grenadeMat", scene);
    mat.diffuseColor = new Color3(0.2, 0.4, 0.2); // Olive green
    grenade.material = mat;

    // 2. Physics
    const aggregate = new PhysicsAggregate(grenade, PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.4, friction: 0.5 }, scene);
    
    // Apply exact network velocity impulse
    aggregate.body.applyImpulse(velocity, grenade.position);

    // 3. Fuse Timer
    setTimeout(() => {
        detonateGrenade(grenade, scene);
    }, GRENADE_FUSE);
}

function detonateGrenade(grenade: Mesh, scene: Scene) {
    const origin = grenade.getAbsolutePosition().clone();
    
    // 1. Visual Explosion
    createExplosionParticles(scene, origin);
    
    // 2. Physics Knockback & Damage (Radial)
    const hitMeshes = scene.meshes.filter(m => {
        if (!m.physicsBody || m === grenade) return false;
        // Optimization: Only push crates or bots
        if (!m.name.startsWith("crate") && !m.name.startsWith("bot_capsule") && m.name !== "player") return false;
        
        const dist = Vector3.Distance(m.getAbsolutePosition(), origin);
        return dist <= EXPLOSION_RADIUS;
    });

    for (const mesh of hitMeshes) {
        const dist = Vector3.Distance(mesh.getAbsolutePosition(), origin);
        const forceMult = 1.0 - (dist / EXPLOSION_RADIUS);
        
        const dir = mesh.getAbsolutePosition().subtract(origin).normalize();
        // Add slight upwards force
        dir.y += 0.5; 
        dir.normalize();

        const impulse = dir.scale(EXPLOSION_FORCE * forceMult * (mesh.physicsBody!.getMassProperties().mass ?? 1));
        mesh.physicsBody!.applyImpulse(impulse, mesh.getAbsolutePosition());
        
        if (mesh.metadata?.isEnemy) {
        }
    }

    // 3. Cleanup
    grenade.dispose();
}

function createExplosionParticles(scene: Scene, position: Vector3) {
    // Fire/Smoke explosion
    const ps = new ParticleSystem("explosion", 200, scene);
    ps.particleTexture = new Texture("https://playground.babylonjs.com/textures/flare.png", scene);
    
    ps.emitter = position;
    ps.minEmitBox = new Vector3(-0.5, -0.5, -0.5);
    ps.maxEmitBox = new Vector3(0.5, 0.5, 0.5);
    
    ps.color1 = new Color4(1.0, 0.5, 0.1, 1.0);
    ps.color2 = new Color4(1.0, 0.2, 0.0, 1.0);
    ps.colorDead = new Color4(0.2, 0.2, 0.2, 0.0);
    
    ps.minSize = 0.5;
    ps.maxSize = 1.5;
    
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;
    
    ps.emitRate = 2000; // Burst
    ps.createSphereEmitter(2, 1);
    
    ps.minEmitPower = 5;
    ps.maxEmitPower = 15;
    ps.updateSpeed = 0.02;
    
    ps.targetStopDuration = 0.1; // Stop emitting quickly to form a burst
    ps.disposeOnStop = true;
    
    ps.start();
}
