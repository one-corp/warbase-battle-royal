// @ts-nocheck
import { Scene, Vector3, MeshBuilder, StandardMaterial, Color3, PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core";
import { generateBuilding } from "./BuildingGenerator";

export function buildBulletForceMap(scene: Scene, shadowGenerator: any, crateTemplate: any, blockTemplate: any, lampMat: any) {
    // Generated Code - Do not edit manually
    generateBuilding(0, 40, 2, 1, -1.5, -58.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(1, 2, 38, 1, -58.5, 1.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(2, 13, 1, 0, -36, -54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(3, 7, 1, 1, -6, -54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(4, 16, 1, 0, 28.5, -54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(5, 2, 38, 1, 55.5, 1.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(6, 3, 3, 0, -51, -48, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_0") : blockTemplate.createInstance("cover_0");
        clone.position.x = -45;
        clone.position.z = -51;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(7, 20, 1, 0, -13.5, -51, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_1") : blockTemplate.createInstance("cover_1");
        clone.position.x = 18;
        clone.position.z = -51;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(8, 6, 1, 0, 28.5, -51, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_2") : blockTemplate.createInstance("cover_2");
        clone.position.x = 39;
        clone.position.z = -51;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(9, 4, 1, 0, 46.5, -51, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(10, 3, 4, 0, -42, -43.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(11, 6, 2, 1, -28.5, -46.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(12, 8, 1, 0, -7.5, -48, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(13, 7, 2, 1, 15, -46.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(14, 7, 2, 0, 36, -46.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(15, 1, 4, 0, 51, -43.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(16, 2, 6, 0, -16.5, -37.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(17, 4, 3, 1, -7.5, -42, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(18, 2, 12, 0, 1.5, -28.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(19, 1, 3, 0, 48, -42, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(20, 2, 2, 0, -52.5, -40.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_3") : blockTemplate.createInstance("cover_3");
        clone.position.x = -48;
        clone.position.z = -42;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(21, 3, 3, 1, -33, -39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(22, 2, 3, 1, -22.5, -39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(23, 3, 3, 1, 9, -39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(24, 3, 3, 1, 21, -39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(25, 3, 2, 0, 30, -40.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_4") : blockTemplate.createInstance("cover_4");
        clone.position.x = 36;
        clone.position.z = -42;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(26, 3, 2, 0, 42, -40.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(27, 1, 1, 0, -48, -39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(28, 1, 2, 1, -27, -37.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(29, 1, 2, 1, 15, -37.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(30, 1, 1, 0, 36, -39, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(31, 4, 2, 1, -49.5, -34.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(32, 2, 9, 0, -40.5, -24, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(33, 4, 1, 0, -7.5, -36, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(34, 2, 9, 0, 28.5, -24, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(35, 7, 2, 1, 42, -34.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(36, 6, 2, 0, -28.5, -31.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(37, 1, 25, 0, -12, 3, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_5") : blockTemplate.createInstance("cover_5");
        clone.position.x = -9;
        clone.position.z = -33;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(38, 2, 3, 0, -4.5, -30, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(39, 7, 2, 0, 15, -31.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(40, 4, 1, 0, -49.5, -30, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(41, 1, 2, 0, -9, -28.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(42, 7, 1, 0, 42, -30, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(43, 3, 6, 0, -51, -19.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_6") : blockTemplate.createInstance("cover_6");
        clone.position.x = -45;
        clone.position.z = -27;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(44, 7, 2, 3, -27, -25.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(45, 1, 6, 0, -15, -19.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(46, 7, 2, 3, 15, -25.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(47, 1, 5, 0, 33, -21, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_7") : blockTemplate.createInstance("cover_7");
        clone.position.x = 36;
        clone.position.z = -27;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(48, 5, 2, 0, 45, -25.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(49, 1, 4, 0, -45, -19.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(50, 3, 3, 1, -6, -21, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(51, 1, 5, 0, 36, -18, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(52, 3, 2, 3, -33, -19.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(53, 3, 2, 3, -21, -19.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(54, 3, 2, 3, 9, -19.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(55, 3, 2, 3, 21, -19.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(56, 1, 4, 0, 39, -16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_8") : blockTemplate.createInstance("cover_8");
        clone.position.x = 42;
        clone.position.z = -21;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(57, 3, 4, 0, 48, -16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(58, 1, 1, 3, -27, -18, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(59, 1, 1, 3, 15, -18, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(60, 1, 3, 0, 42, -15, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(61, 7, 2, 0, -27, -13.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(62, 3, 1, 0, -6, -15, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(63, 7, 2, 0, 15, -13.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_9") : blockTemplate.createInstance("cover_9");
        clone.position.x = -45;
        clone.position.z = -12;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_10") : blockTemplate.createInstance("cover_10");
        clone.position.x = -9;
        clone.position.z = -12;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(64, 2, 9, 0, -4.5, 0, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_11") : blockTemplate.createInstance("cover_11");
        clone.position.x = 33;
        clone.position.z = -12;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(65, 6, 2, 2, -46.5, -7.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(66, 2, 12, 0, -34.5, 7.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(67, 6, 3, 2, -22.5, -6, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(68, 1, 4, 0, -9, -4.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(69, 6, 3, 2, 7.5, -6, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(70, 2, 12, 0, 19.5, 7.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(71, 10, 2, 2, 37.5, -7.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(72, 3, 3, 2, -51, 0, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(73, 2, 3, 2, -40.5, 0, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(74, 2, 3, 2, 25.5, 0, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(75, 7, 3, 2, 42, 0, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(76, 1, 2, 2, -45, 1.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(77, 6, 1, 0, -22.5, 0, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(78, 6, 1, 0, 7.5, 0, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(79, 1, 2, 2, 30, 1.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(80, 2, 2, 0, -28.5, 4.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_12") : blockTemplate.createInstance("cover_12");
        clone.position.x = -24;
        clone.position.z = 3;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(81, 3, 2, 0, -18, 4.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_13") : blockTemplate.createInstance("cover_13");
        clone.position.x = -9;
        clone.position.z = 3;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_14") : blockTemplate.createInstance("cover_14");
        clone.position.x = 0;
        clone.position.z = 3;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(82, 5, 2, 0, 9, 4.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(83, 6, 1, 0, -46.5, 6, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(84, 1, 1, 0, -24, 6, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(85, 1, 1, 0, -9, 6, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(86, 1, 17, 0, 0, 30, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(87, 10, 1, 0, 37.5, 6, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(88, 3, 11, 0, -51, 24, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_15") : blockTemplate.createInstance("cover_15");
        clone.position.x = -45;
        clone.position.z = 9;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(89, 2, 16, 0, -40.5, 31.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(90, 4, 2, 1, -25.5, 10.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(91, 2, 6, 0, -16.5, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_16") : blockTemplate.createInstance("cover_16");
        clone.position.x = -9;
        clone.position.z = 9;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(92, 1, 16, 0, 3, 31.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(93, 4, 2, 1, 10.5, 10.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(94, 3, 6, 0, 27, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_17") : blockTemplate.createInstance("cover_17");
        clone.position.x = 33;
        clone.position.z = 9;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(95, 6, 2, 0, 43.5, 10.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(96, 1, 2, 0, -45, 13.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(97, 1, 4, 0, -9, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(98, 1, 4, 0, 33, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(99, 2, 2, 1, -28.5, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(100, 1, 2, 1, -21, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_18") : blockTemplate.createInstance("cover_18");
        clone.position.x = -6;
        clone.position.z = 15;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(101, 1, 5, 0, -3, 21, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(102, 1, 2, 1, 6, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(103, 2, 2, 1, 13.5, 16.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(104, 3, 9, 0, 39, 27, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_19") : blockTemplate.createInstance("cover_19");
        clone.position.x = 45;
        clone.position.z = 15;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(105, 2, 9, 0, 49.5, 27, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_20") : blockTemplate.createInstance("cover_20");
        clone.position.x = -45;
        clone.position.z = 18;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(106, 1, 1, 1, -24, 18, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(107, 1, 4, 0, -6, 22.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(108, 1, 1, 1, 9, 18, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(109, 1, 4, 0, 45, 22.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(110, 1, 2, 0, -45, 22.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(111, 4, 2, 0, -25.5, 22.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(112, 4, 2, 0, 10.5, 22.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_21") : blockTemplate.createInstance("cover_21");
        clone.position.x = -9;
        clone.position.z = 24;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_22") : blockTemplate.createInstance("cover_22");
        clone.position.x = 33;
        clone.position.z = 24;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_23") : blockTemplate.createInstance("cover_23");
        clone.position.x = -45;
        clone.position.z = 27;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(113, 7, 2, 3, -27, 28.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(114, 1, 10, 0, -15, 40.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(115, 1, 1, 0, -9, 27, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(116, 7, 2, 3, 15, 28.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(117, 3, 5, 0, 30, 33, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(118, 1, 4, 0, -45, 34.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(119, 3, 3, 1, -6, 33, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_24") : blockTemplate.createInstance("cover_24");
        clone.position.x = 45;
        clone.position.z = 30;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(120, 3, 2, 3, -33, 34.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(121, 3, 2, 3, -21, 34.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(122, 3, 2, 3, 9, 34.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(123, 3, 2, 3, 21, 34.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(124, 1, 3, 0, 45, 36, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(125, 1, 1, 3, -27, 36, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(126, 1, 1, 3, 15, 36, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(127, 7, 1, 0, -27, 39, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(128, 3, 3, 0, -6, 42, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(129, 7, 1, 0, 15, 39, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(130, 4, 2, 1, -49.5, 43.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(131, 3, 1, 0, -33, 42, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_25") : blockTemplate.createInstance("cover_25");
        clone.position.x = -27;
        clone.position.z = 42;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(132, 3, 1, 0, -21, 42, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_26") : blockTemplate.createInstance("cover_26");
        clone.position.x = -12;
        clone.position.z = 42;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(133, 2, 1, 0, 7.5, 42, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_27") : blockTemplate.createInstance("cover_27");
        clone.position.x = 12;
        clone.position.z = 42;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(134, 6, 1, 0, 22.5, 42, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(135, 7, 2, 1, 42, 43.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(136, 6, 2, 1, -28.5, 46.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(137, 1, 4, 0, -18, 49.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(138, 1, 1, 0, -12, 45, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(139, 6, 2, 1, 13.5, 46.5, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(140, 3, 4, 0, 27, 49.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(141, 4, 1, 0, -49.5, 48, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(142, 4, 4, 1, -7.5, 52.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(143, 7, 1, 0, 42, 48, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(144, 3, 1, 0, -48, 51, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(145, 3, 3, 1, -33, 54, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(146, 2, 3, 1, -22.5, 54, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(147, 3, 3, 1, 9, 54, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(148, 2, 3, 1, 19.5, 54, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(149, 5, 1, 0, 39, 51, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(150, 1, 2, 0, 51, 52.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(151, 3, 1, 0, -51, 54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_28") : blockTemplate.createInstance("cover_28");
        clone.position.x = -45;
        clone.position.z = 54;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(152, 1, 2, 1, -27, 55.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    generateBuilding(153, 1, 2, 1, 15, 55.5, new Vector3(1, 0, 0), scene, shadowGenerator, true);
    {
        const isCrate = Math.random() > 0.5;
        const clone = isCrate ? crateTemplate.createInstance("cover_29") : blockTemplate.createInstance("cover_29");
        clone.position.x = 33;
        clone.position.z = 54;
        clone.position.y = isCrate ? 1 : 0.75;
        clone.rotation.y = Math.random() * Math.PI;
        if (shadowGenerator) shadowGenerator.addShadowCaster(clone, true);
        clone.receiveShadows = true;
        new PhysicsAggregate(clone, PhysicsShapeType.BOX, { mass: 0 }, scene);
    }
    generateBuilding(154, 5, 1, 0, 42, 54, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(155, 6, 1, 1, -46.5, 57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(156, 2, 1, 1, -16.5, 57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(157, 2, 1, 1, 1.5, 57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
    generateBuilding(158, 10, 1, 1, 37.5, 57, new Vector3(0, 0, -1), scene, shadowGenerator, true);
}
