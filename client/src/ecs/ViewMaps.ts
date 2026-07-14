import { Mesh, PhysicsBody, UniversalCamera } from "@babylonjs/core";

// Maps to connect ECS entity IDs (integers) to heavy external objects

export const entityMeshes = new Map<number, Mesh>();
export const entityPhysicsBodies = new Map<number, PhysicsBody>();
export const entityCameras = new Map<number, UniversalCamera>();
