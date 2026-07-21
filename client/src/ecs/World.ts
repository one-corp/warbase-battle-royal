import { createWorld, getAllEntities, removeEntity } from "bitecs";
import type { IWorld } from "bitecs";

export const world: IWorld = createWorld();

export function clearECSWorld() {
    const entities = getAllEntities(world);
    for (let i = 0; i < entities.length; i++) {
        removeEntity(world, entities[i]);
    }
}
