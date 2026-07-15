// @ts-nocheck
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core";
import { generateBuilding } from "./BuildingGenerator";

export function buildDust2Map(scene: Scene, shadowGenerator: any, crateTemplate: any, blockTemplate: any, lampMat: any) {
    // Generated Code - Do not edit manually
    generateBuilding(0, 40, 1, 1, -1.5, -60, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(1, 8, 1, 1, -49.5, -57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(2, 3, 1, 0, -33, -57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_0") : blockTemplate.createInstance("cover_0");
        clone.position.x = -27;
        clone.position.z = -57;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(3, 5, 1, 0, -18, -57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(4, 6, 1, 1, -1.5, -57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(5, 2, 3, 0, 10.5, -54, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(6, 3, 3, 0, 21, -54, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(7, 11, 1, 1, 42, -57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(8, 6, 1, 1, -52.5, -54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(9, 3, 2, 0, -39, -52.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_1") : blockTemplate.createInstance("cover_1");
        clone.position.x = -33;
        clone.position.z = -54;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(10, 3, 2, 0, -27, -52.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_2") : blockTemplate.createInstance("cover_2");
        clone.position.x = -21;
        clone.position.z = -54;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(11, 3, 1, 0, -15, -54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(12, 4, 3, 1, -4.5, -51, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(13, 2, 6, 0, 4.5, -46.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(14, 1, 2, 0, 15, -52.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(15, 1, 7, 0, 27, -45, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(16, 4, 1, 1, 34.5, -54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(17, 2, 2, 0, 43.5, -52.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(18, 1, 6, 0, 51, -46.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(19, 2, 38, 1, 55.5, 1.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(20, 5, 1, 1, -54, -51, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(21, 1, 3, 0, -45, -48, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(22, 1, 18, 0, -33, -25.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(23, 2, 1, 0, -19.5, -51, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_3") : blockTemplate.createInstance("cover_3");
        clone.position.x = -15;
        clone.position.z = -51;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(24, 1, 12, 0, -12, -34.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(25, 3, 2, 1, 33, -49.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(26, 1, 5, 0, 39, -45, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(27, 1, 24, 0, 48, -16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(28, 3, 8, 1, -57, -37.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(29, 2, 2, 0, -49.5, -46.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(30, 1, 2, 0, -42, -46.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_4") : blockTemplate.createInstance("cover_4");
        clone.position.x = -39;
        clone.position.z = -48;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(31, 1, 17, 0, -36, -24, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(32, 2, 2, 0, -28.5, -46.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(33, 3, 7, 1, -21, -39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(34, 1, 11, 0, -15, -33, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(35, 1, 4, 0, 9, -43.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(36, 3, 6, 1, 15, -40.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(37, 2, 5, 0, 22.5, -42, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(38, 1, 4, 0, 42, -43.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_5") : blockTemplate.createInstance("cover_5");
        clone.position.x = 45;
        clone.position.z = -48;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(39, 1, 10, 0, -39, -31.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(40, 3, 1, 1, -6, -45, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(41, 1, 3, 0, 0, -42, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(42, 3, 1, 0, 33, -45, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(43, 1, 1, 0, 45, -45, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(44, 4, 6, 1, -46.5, -34.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(45, 2, 5, 1, -28.5, -36, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(46, 3, 1, 0, -6, -42, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(47, 3, 4, 1, 33, -37.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_6") : blockTemplate.createInstance("cover_6");
        clone.position.x = 45;
        clone.position.z = -42;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(48, 3, 7, 1, -6, -30, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(49, 1, 20, 0, 45, -10.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(50, 4, 3, 1, 4.5, -33, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(51, 2, 2, 1, 40.5, -34.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(52, 1, 32, 1, 51, 10.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(53, 3, 1, 2, 24, -33, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(54, 2, 1, 1, 13.5, -30, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(55, 9, 1, 0, 30, -30, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(56, 5, 1, 0, -24, -27, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(57, 1, 3, 1, 0, -24, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(58, 7, 1, 0, 12, -27, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(59, 7, 13, 1, 33, -9, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(60, 2, 28, 1, -58.5, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(61, 5, 1, 0, -48, -24, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(62, 5, 6, 1, -24, -16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(63, 3, 25, 0, 6, 12, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(64, 4, 12, 1, 16.5, -7.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(65, 3, 2, 0, -51, -19.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_7") : blockTemplate.createInstance("cover_7");
        clone.position.x = -45;
        clone.position.z = -21;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(66, 1, 2, 0, -42, -19.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(67, 1, 1, 0, -45, -18, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(68, 4, 1, 0, -4.5, -18, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(69, 6, 8, 1, -46.5, -4.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(70, 2, 3, 1, -13.5, -12, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(71, 2, 6, 0, -7.5, -7.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(72, 2, 18, 1, -1.5, 10.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(73, 7, 1, 0, -21, -6, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_8") : blockTemplate.createInstance("cover_8");
        clone.position.x = -30;
        clone.position.z = -3;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(74, 2, 2, 0, -25.5, -1.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_9") : blockTemplate.createInstance("cover_9");
        clone.position.x = -21;
        clone.position.z = -3;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(75, 3, 2, 0, -15, -1.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(76, 1, 1, 0, -30, 0, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(77, 1, 1, 0, -21, 0, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(78, 7, 2, 1, -27, 4.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(79, 2, 9, 0, -13.5, 15, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(80, 2, 12, 1, -7.5, 19.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(81, 7, 1, 0, -45, 9, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(82, 6, 2, 1, -25.5, 10.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(83, 3, 3, 0, -51, 15, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_10") : blockTemplate.createInstance("cover_10");
        clone.position.x = -45;
        clone.position.z = 12;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(84, 3, 6, 0, -39, 19.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(85, 11, 1, 0, 27, 12, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(86, 1, 2, 0, -45, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(87, 6, 1, 0, -25.5, 15, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_11") : blockTemplate.createInstance("cover_11");
        clone.position.x = 12;
        clone.position.z = 15;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(88, 2, 2, 0, 16.5, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_12") : blockTemplate.createInstance("cover_12");
        clone.position.x = 21;
        clone.position.z = 15;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(89, 3, 2, 0, 27, 16.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(90, 4, 15, 1, 37.5, 36, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(91, 6, 3, 1, -25.5, 21, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(92, 1, 1, 0, 12, 18, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(93, 1, 1, 0, 21, 18, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(94, 4, 13, 1, -49.5, 39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(95, 7, 13, 1, 21, 39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(96, 2, 13, 1, 46.5, 39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(97, 6, 1, 0, -25.5, 27, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(98, 3, 10, 1, -39, 43.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(99, 3, 7, 0, -30, 39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(100, 5, 3, 1, -18, 33, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(101, 9, 1, 0, -12, 39, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(102, 4, 3, 0, -19.5, 45, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_13") : blockTemplate.createInstance("cover_13");
        clone.position.x = -12;
        clone.position.z = 42;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(103, 2, 1, 0, -7.5, 42, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_14") : blockTemplate.createInstance("cover_14");
        clone.position.x = -3;
        clone.position.z = 42;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(104, 1, 3, 0, 0, 45, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(105, 1, 2, 0, -12, 46.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(106, 2, 2, 0, -4.5, 46.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(107, 1, 1, 0, -9, 48, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(108, 15, 3, 1, -12, 54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
}
