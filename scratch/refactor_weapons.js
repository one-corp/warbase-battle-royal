const fs = require('fs');

const original = fs.readFileSync('client/src/physics/WeaponSystem.ts', 'utf8');
const ecsBase = fs.readFileSync('client/src/physics/WeaponSystemECS.ts', 'utf8');

// Extract init logic from original (lines ~157 to ~350)
const initMatch = original.match(/public async init\(\) \{([\s\S]*?)(?=this\.scene\.onBeforeRenderObservable\.add)/);
let initBody = initMatch ? initMatch[1] : '';

// Fix `this.` references in initBody
initBody = initBody.replace(/this\.scene/g, 'scene');
initBody = initBody.replace(/this\.playerEid/g, 'playerEid');
initBody = initBody.replace(/this\.networkManager/g, 'networkManager');

// Fix `this.activeConfig` and `this.currentAmmo` for the UI
initBody = initBody.replace(/this\.activeConfig\.id/g, 'WEAPON_CONFIGS[WeaponStateComponent.activeWeaponIndex[playerEid]].id');
initBody = initBody.replace(/this\.currentAmmo/g, 'WeaponStateComponent.currentAmmo[playerEid]');

// We don't need `this.playAnim` anymore because animations should be handled by ECS or left alone for now?
// Actually, animations are hard. We can map `entityWeaponAnims.set(playerEid, animGroups)`.
initBody = initBody.replace(/this\.playAnim =/g, 'const playAnim =');
initBody = initBody.replace(/this\.currentAnim/g, 'let currentAnim');

// Remove updateUI() calls, we use CustomEvent now
initBody = initBody.replace(/const ammoText = document\.getElementById\("ammoText"\);\s+const updateUI =.*?\s+updateUI\(\);/g, `
    const ammoText = document.getElementById("ammoText");
    window.addEventListener('ammo-update', (e) => {
        if (ammoText) ammoText.innerText = \`AMMO: \${e.detail.ammo} / \${e.detail.max}\`;
    });
`);


// Extract createMuzzleFlash and createShellEjector
const createMuzzleFlash = `
export const createMuzzleFlash = (parent: AbstractMesh, scene: Scene): ParticleSystem => {
    const ps = new ParticleSystem("muzzleFlash", 15, scene);
    ps.particleTexture = null as any; 
    ps.emitter = parent;
    ps.emitRate = 0;
    ps.minLifeTime = 0.03;
    ps.maxLifeTime = 0.08;
    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.color1 = new Color4(1.0, 0.8, 0.3, 1.0);
    ps.colorDead = new Color4(1.0, 0.2, 0.0, 0.0);
    return ps;
};
`;

const createShellEjector = `
export const createShellEjector = (parent: AbstractMesh, scene: Scene): ParticleSystem => {
    const ps = new ParticleSystem("shells", 10, scene);
    ps.particleTexture = null as any; 
    ps.emitter = parent;
    ps.emitRate = 0;
    ps.minLifeTime = 1.0;
    ps.maxLifeTime = 1.5;
    ps.minSize = 0.03;
    ps.maxSize = 0.04;
    ps.color1 = new Color4(0.8, 0.7, 0.2, 1.0); 
    ps.color2 = new Color4(0.7, 0.6, 0.1, 1.0);
    ps.colorDead = new Color4(0.5, 0.4, 0.1, 0.0);
    ps.direction1 = new Vector3(1, 1, 0);
    ps.direction2 = new Vector3(2, 2, 0.5);
    ps.gravity = new Vector3(0, -9.81, 0);
    return ps;
};
`;

// Fix missing Map inserts
initBody += `
    // ADD OBJECTS TO ECS VIEWMAPS
    entitySwayRoots.set(playerEid, swayRoot);
    entityWeaponSocketOffsets.set(playerEid, weaponSocketOffset);
    entityAKRoots.set(playerEid, akRoot);
    entityPistolRoots.set(playerEid, pistolRoot);
    entityAimPoints.set(playerEid, aimPoint);
    entityFlashParticles.set(playerEid, flash);
    entityShellParticles.set(playerEid, shellEjector);
    
    // Initialize ECS State
    WeaponStateComponent.activeWeaponIndex[playerEid] = 0; // AK47
    WeaponStateComponent.currentAmmo[playerEid] = WEAPON_CONFIGS[0].magSize;
    WeaponStateComponent.isReloading[playerEid] = 0;
    WeaponStateComponent.currentSpread[playerEid] = WEAPON_CONFIGS[0].baseSpread;
    WeaponStateComponent.adsProgress[playerEid] = 0;
`;

// Also fix the fact that `this.createMuzzleFlash` was called in initBody
initBody = initBody.replace(/this\.createMuzzleFlash\(muzzlePoint\)/g, 'createMuzzleFlash(muzzlePoint, scene)');
initBody = initBody.replace(/this\.createShellEjector\(shellPoint\)/g, 'createShellEjector(shellPoint, scene)');

const finalContent = `${ecsBase}

${createMuzzleFlash}

${createShellEjector}

export const initWeapons = async (playerEid: number, scene: Scene, networkManager?: NetworkManager) => {
${initBody}
};
`;

fs.writeFileSync('client/src/physics/WeaponSystem.ts', finalContent);
console.log("Refactored WeaponSystem.ts successfully.");
