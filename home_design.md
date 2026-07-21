# WARBASE — Main Menu & UI Design Specification

## Overview
This document specifies the official 1:1 Battlefield/CoD-inspired UI architecture and design language for **WARBASE Tactical FPS**.

---

## 1. Design Aesthetics & Layout

### **Top Navigation Bar**
- **Left**: Player Profile Badge (`NERDY4TW` + Star Emblem).
- **Center**: Primary Navigation Tabs:
  - `LOADOUTS` (Default Active Tab)
  - `JOIN ROOM` (Server Browser)
  - `CREATE ROOM` (Combat Zone Initialization)
  - `SETTINGS` (System Graphics & Audio Controls)
- **Right**: In-Game Currency / Status Display (`$ 27,640`).

---

## 2. 3-Column Loadout Architecture

The **LOADOUTS** tab features a clean, high-contrast 3-column layout:

### **Left Column: Class Selection & Perks**
- **Class Items**:
  - `ASSAULT`
  - `TACTICAL` *(Active State: Solid White `#FFFFFF` container with bold Black `#000000` text)*
  - `SUPPORT`
  - `ENGINEER`
  - `MEDIC`
- **Class Description**: Tactical overview paragraph explaining class abilities and weapon proficiencies.
- **Perks Section**: 3-slot perk indicator row (`🛡️`, `🎯`, `🔒`) with dashed/solid borders.

### **Center Column: 3D Character Showcase**
- Completely transparent backdrop allowing the Babylon.js 3D character model on the canvas behind the UI to act as the primary visual element.

### **Right Column: Weapon Slots**
- **Primary Weapon**: `M416` + Vector Silhouette.
- **Sidearm**: `GLOCK 18C` + Vector Silhouette.
- **Gadget**: `FLASHBANG` + Vector Silhouette.
- Each category features a 1px solid White (`rgba(255, 255, 255, 0.2)`) separator line and uppercase category titles.

---

## 3. Footer / Action Bar
- **Left**: Squad / Social indicator (`[LT] 👥 14`).
- **Right**: Gamepad & Keyboard action prompts (`(A) EDIT`, `(Y) RENAME`).

---

## 4. Typography & Color Palette

### **Color Palette**
- **Primary Text & Active Elements**: Pure White (`#FFFFFF`)
- **Secondary Text / Labels**: Light Gray (`rgba(255, 255, 255, 0.6)`)
- **Active Container Highlight**: Solid White (`#FFFFFF`) with Pure Black (`#000000`) text
- **Backgrounds**: Transparent Radial Gradient (`rgba(15,18,25,0.75)` to `rgba(5,7,10,0.92)`)
- **Accent Lines**: 1px White borders (`rgba(255, 255, 255, 0.1)`)
- *Note: Gold (`#CFA55F`) and Cyan (`#00FFCC`) have been completely deprecated in favor of this strict monochrome palette.*

### **Typography**
- **Headers & Menu Tabs**: `Oswald` (Sans-serif, Uppercase, bold, 2px - 4px letter-spacing)
- **Descriptions**: `Inter` / `Segoe UI` (Clean sans-serif for high legibility)
- **Monospace Stats**: `Share Tech Mono` (Used for server browser stats and map IDs)
