# 🔫 Weapon Design & Architecture

> Tracking the visual design, modeling, and positioning of our in-game weapons.

---

## 1. Current Arsenal

Our game currently features **two** native procedural weapons:
1. **AK-47** (Primary - Default)
2. **Pistol** (Secondary)

We are currently using the **AK-47**, not the M4. 

---

## 2. Modeling Approach: Procedural Native Meshes

Currently, instead of loading an external `.glb` file for the weapons, we are building them **procedurally** inside `WeaponSystem.ts` using Babylon's `MeshBuilder`. 

This is incredibly performant and ensures our download size stays tiny, but it means the design is "blocky" and low-poly. 

### 2.1 AK-47 Breakdown
The AK-47 is built from 5 primitive shapes grouped under an `akRoot` TransformNode:
- **Grip**: Box (`width: 0.04, height: 0.12, depth: 0.06`) tilted at $\pi/8$.
- **Receiver**: Box (`width: 0.05, height: 0.08, depth: 0.3`).
- **Barrel**: Cylinder (`diameter: 0.02, height: 0.4`).
- **Magazine**: Box tilted forward (`-Math.PI/8`).
- **Stock**: Box extending backwards to rest on the shoulder.

### 2.2 Pistol Breakdown
The Pistol is a much simpler 2-part mesh:
- **Grip**: Small box.
- **Receiver (Slide)**: Short box resting on top of the grip.

---

## 3. Materials & Textures

We currently use two basic PBR/Standard materials for the weapons:
1. **Gunmetal**: `Color3(0.2, 0.2, 0.2)` with a slight specular shine for metallic parts (barrel, receiver, stock).
2. **Matte Black**: `Color3(0.05, 0.05, 0.05)` with no shine for polymer/plastic parts (grip, magazine).

---

## 4. Rigging and Positioning (The Weapon Socket)

To make the weapon move seamlessly with the player's arms, we use a **Socket Architecture**.

### 4.1 The Socket
1. The game loads the `AnimatedSoldier.glb` viewmodel.
2. We find the bone named `RightHand`.
3. We attach a `WeaponSocketRoot` node directly to this bone (`attachToBone`).
4. We parent the weapon (e.g., `akRoot`) to the socket.

### 4.2 Hand Offsets
Because bones in `.glb` files (like Mixamo rigs) often have arbitrary rotations, we must apply offsets so the gun rests perfectly in the palm of the hand pointing forward.

Current offsets defined in `WeaponSystem.ts`:
- **Position Offset (`socketPos`)**: `[0, 0, 0]` (The root of our procedural gun is exactly at the grip).
- **Rotation Offset (`socketRot`)**: `[Math.PI / 2, 0, 0]` (Rotated 90 degrees on the X-axis so it points forward rather than down the arm).

---

## 5. Aim Down Sights (ADS) Alignment

We use an "Industry Standard" AimPoint approach to handle ADS.
1. We place an invisible `AimPoint` node precisely on top of the gun's iron sights (`y: 0.08, z: 0.1`).
2. When the player holds right-click, we calculate the mathematical difference between the camera's center and the `AimPoint`.
3. We translate the entire viewmodel (arms + gun) to perfectly bridge that gap, ensuring the iron sight aligns exactly with the center of the screen.

---

## 6. Next Steps for Detailing

To make the weapons look more detailed and realistic, we have two paths to track here:

### Path A: Upgrade the Procedural Meshes
- Add a handguard (wood/polymer texture).
- Add physical iron sights (small protruding cubes at the front and back of the barrel).
- Add an ejection port and charging handle.
- Apply high-res PBR textures (scratched metal, wood grain) instead of solid colors.

### Path B: Import external `.glb` Weapon Models
- Replace the primitive boxes entirely with a highly detailed M4A1 or AK-47 `.glb` downloaded from Sketchfab.
- **Requirement**: Must adjust the `socketPos` and `socketRot` specifically for the new mesh's pivot point.
- **Requirement**: Must re-position the `AimPoint` node to align with the new model's actual physical sights.
