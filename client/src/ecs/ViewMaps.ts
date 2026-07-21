import { Mesh, PhysicsBody, UniversalCamera, TransformNode, ParticleSystem } from "@babylonjs/core";

// Maps to connect ECS entity IDs (integers) to heavy external objects

export const entityMeshes = new Map<number, Mesh>();
export const entityPhysicsBodies = new Map<number, PhysicsBody>();
export const entityCameras = new Map<number, UniversalCamera>();

// Weapon System Maps
export const entitySwayRoots = new Map<number, TransformNode>();
export const entityWeaponSocketOffsets = new Map<number, TransformNode>();
export const entityAKRoots = new Map<number, TransformNode>();
export const entityPistolRoots = new Map<number, TransformNode>();
export const entityAimPoints = new Map<number, TransformNode>();
export const entityFlashParticles = new Map<number, ParticleSystem>();
export const entityShellParticles = new Map<number, ParticleSystem>();

export function clearAllViewMaps() {
    entityMeshes.clear();
    entityPhysicsBodies.clear();
    entityCameras.clear();
    entitySwayRoots.clear();
    entityWeaponSocketOffsets.clear();
    entityAKRoots.clear();
    entityPistolRoots.clear();
    entityAimPoints.clear();
    entityFlashParticles.clear();
    entityShellParticles.clear();
}
