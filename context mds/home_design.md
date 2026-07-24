# WARBASE — Main Menu & UI Design Specification

## Overview
This document specifies the official 1:1 Battlefield/CoD-inspired UI architecture and design language for **WARBASE Tactical FPS**.

---

## 1. Interactive Top Navigation Bar
- **Player Callsign Badge** (`[EDIT ✏️]`): Clickable span & keybinding `[R / (Y)]`. Opens an interactive prompt allowing players to change their Callsign/Name. Persisted in `localStorage` and sent to the Go WebSocket server upon match deployment.
- **Primary Navigation Tabs**:
  - `LOADOUTS` (Default Active Tab)
  - `JOIN MATCH` (Match Browser with dynamic match list & auto-refresh)
  - `CREATE MATCH` (Combat Zone/Match Initialization)
  - `SETTINGS` (System Graphics & Audio Controls)
- **Currency/Economy**: None (Dummy currency counters have been removed to keep the interface clean and focused).

---

## 2. Interactive 3-Column Loadout System

### **Left Column: Class Selector & Perks**
- **Class Items**:
  - `ASSAULT`: Equips AK-47, Deagle, Frag Grenades, Lightweight perk.
  - `TACTICAL`: Equips M416 Carbine, Glock 18C, Flashbang, Body Armor perk.
  - `SUPPORT`: Equips M249 LMG, M1911 Pistol, Ammo Crate, Heavy Gunner perk.
  - `ENGINEER`: Equips MP5 SMG, .44 Revolver, C4 Explosives, Demolition perk.
  - `MEDIC`: Equips SCAR-L Rifle, USP Compact, Medkit, Combat Medic perk.
- **Dynamic Descriptions**: Selecting any class dynamically updates description, weapon silhouettes, and perks.
- **Interactive Perks**: Clicking any perk slot toggles its active state and displays its full tactical effect tooltip.

### **Center Column: 3D Character Viewport**
- Fully transparent backdrop allowing the 3D player model on canvas behind to serve as the visual centerpiece.

### **Right Column: Interactive Weapon Swapping**
- **Primary / Sidearm / Gadget Slots**: Every slot is clickable and features `[SWAP ⚙️]` triggers.
- **Weapon Selection Modal**: Clicking any slot opens a modal allowing operators to select alternative weapons (M416, AK-47, M249, MP5, SCAR-L, Sniper R700, Deagle, Glock, C4, Flashbang, etc.).

---

## 3. Footer Action Prompts & Keybindings
- **Live Online Counter**: `👥 ONLINE PLAYERS: [X]` dynamically calculated from active matches.
- **Keybindings**:
  - Pressing `E` or `[E / (A)]` opens the Weapon Swap Selector.
  - Pressing `R` or `[R / (Y)]` opens the Callsign Rename prompt.

---

## 4. Typography & Color Palette
- **Primary Text**: Pure White (`#FFFFFF`)
- **Active Container Highlight**: Solid White (`#FFFFFF`) with Pure Black (`#000000`) text
- **Backgrounds**: Transparent Radial Gradient (`rgba(15,18,25,0.75)` to `rgba(5,7,10,0.92)`)
- **Typography**: 
  - **Outfit** (Headers, tabs, modal panels, buttons, HUD panels) — chosen for its modern geometric layout and exceptional readability.
  - **Inter** (Fine descriptions, list grids, graphics toggles) — clean sans-serif readability.
  - **Share Tech Mono** (Ping stats, scoreboard numbers, digital indicators) — clean monospace alignment.
- **Primary Accent Color**: Crimson Red (`#ff2a4b`) for center crosshairs, active selection outlines, and warnings.
