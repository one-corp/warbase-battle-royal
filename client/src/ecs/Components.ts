import { defineComponent, Types } from "bitecs";

export const Position = defineComponent({
    x: Types.f32,
    y: Types.f32,
    z: Types.f32,
});

export const Rotation = defineComponent({
    x: Types.f32,
    y: Types.f32,
    z: Types.f32,
    w: Types.f32,
});

export const Velocity = defineComponent({
    x: Types.f32,
    y: Types.f32,
    z: Types.f32,
});

export const InputComponent = defineComponent({
    forward: Types.ui8,
    backward: Types.ui8,
    left: Types.ui8,
    right: Types.ui8,
    jump: Types.ui8,
    crouch: Types.ui8,
    sprint: Types.ui8,
    fire: Types.ui8,
    ads: Types.ui8,
    reload: Types.ui8,
    weapon1: Types.ui8,
    weapon2: Types.ui8,
    grenade: Types.ui8,
    mouseDeltaX: Types.f32,
    mouseDeltaY: Types.f32
});

export const PlayerComponent = defineComponent({
    isGrounded: Types.ui8,
    isCrouching: Types.ui8,
    isSprinting: Types.ui8,
    jumpCooldownTimer: Types.f32,
    coyoteTimer: Types.f32,
    yaw: Types.f32,
    pitch: Types.f32
});

// Tags (empty components used like bitmasks)
export const Renderable = defineComponent();
export const PhysicsBodyTag = defineComponent();
export const PlayerTag = defineComponent();

// --- WEAPON SYSTEM COMPONENTS ---

export const WeaponStateComponent = defineComponent({
    activeWeaponIndex: Types.ui8,
    currentAmmo: Types.ui16,
    isReloading: Types.ui8,
    reloadTimer: Types.f32,
    currentSpread: Types.f32,
    lastFireTime: Types.f32,
    adsProgress: Types.f32,
});

export const RecoilComponent = defineComponent({
    offsetX: Types.f32,
    offsetY: Types.f32,
    kickbackZ: Types.f32,
    kickbackRotX: Types.f32,
});

export const SwayComponent = defineComponent({
    swayX: Types.f32,
    swayY: Types.f32,
    walkBobTimer: Types.f32,
});
