import { Scene, Vector3, ParticleSystem, Texture, Color4 } from "@babylonjs/core";

let sparkSystem: ParticleSystem | null = null;

export function initImpactSystem(scene: Scene) {
    // If spark system exists but belongs to an old/disposed scene, we must recreate it
    if (sparkSystem && sparkSystem.getScene() === scene) return;
    
    // Cleanup old if it exists
    if (sparkSystem && sparkSystem.getScene() !== scene) {
        sparkSystem.dispose();
    }

    sparkSystem = new ParticleSystem("sparks", 200, scene);
    
    // Use a cloud/smoke texture instead of a flare
    sparkSystem.particleTexture = new Texture("https://assets.babylonjs.com/textures/cloud.png", scene);
    
    // Spark settings
    sparkSystem.emitRate = 0; // Only emit manually
    sparkSystem.minEmitBox = new Vector3(0, 0, 0); 
    sparkSystem.maxEmitBox = new Vector3(0, 0, 0); 
    
    sparkSystem.color1 = new Color4(0.5, 0.5, 0.5, 0.8); // Light grey smoke
    sparkSystem.color2 = new Color4(0.2, 0.2, 0.2, 0.5); // Dark grey smoke
    sparkSystem.colorDead = new Color4(0, 0, 0, 0);

    sparkSystem.minSize = 0.1;
    sparkSystem.maxSize = 0.4;
    
    sparkSystem.minLifeTime = 0.3;
    sparkSystem.maxLifeTime = 0.8;
    
    sparkSystem.gravity = new Vector3(0, 1.5, 0); // Smoke drifts slightly upwards
    
    // Spray properties
    sparkSystem.direction1 = new Vector3(-1, 0, -1);
    sparkSystem.direction2 = new Vector3(1, 1, 1);
    sparkSystem.minEmitPower = 0.5;
    sparkSystem.maxEmitPower = 2.0;
    sparkSystem.updateSpeed = 0.01;
    
    sparkSystem.start();
}

export function spawnImpact(position: Vector3, normal: Vector3) {
    if (!sparkSystem) return;
    
    // Set emitter to hit point
    sparkSystem.emitter = position;
    
    // Puff smoke away from the normal with less spread
    sparkSystem.direction1 = normal.subtract(new Vector3(0.2, 0.2, 0.2));
    sparkSystem.direction2 = normal.add(new Vector3(0.2, 0.2, 0.2));
    
    // Shoot a small burst of smoke puffs
    sparkSystem.manualEmitCount = Math.floor(Math.random() * 2) + 2; // 2-3 puffs
}
