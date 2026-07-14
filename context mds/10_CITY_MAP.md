# Bullet Force "City" Map Blueprint

This document tracks the precise layout, dimensions, and architectural coordinates for our 1:1 scale recreation of the Bullet Force "City" map.

## 1. General Layout
- **Shape:** A massive **L-shaped** main avenue serves as the central artery.
- **Scale:** Extremely large, emphasizing long sniper sightlines.
- **Verticality:** Ground-level streets surrounded by towering skyscrapers, with accessible rooftops.

## 2. Key Zones & Coordinates
*Note: We will map the L-shape such that the corner of the 'L' is near the center `(0, 0, 0)`.*

### The L-Shaped Avenue
- **North-South Leg:** A wide road extending from the central intersection towards the North (Z-axis).
- **East-West Leg:** A wide road extending from the central intersection towards the East (X-axis).
- **Intersection:** The central combat zone `(0, 0, 0)`.

### The Four Main Towers
Located on the four quadrants surrounding the L-intersection:
1. **Central Tower (The Sniper Haven):** Inside the elbow of the 'L'. The tallest skyscraper on the map. Features an internal working elevator leading to the roof.
2. **Fourth Tower:** Located diagonally opposite the Central Tower. Also features an accessible roof and elevator.
3. **North-East Tower:** Flanking the outer corner.
4. **South-West Tower:** Flanking the other outer corner.

### Unique Landmarks
- **Construction Crane:** Situated near the main intersection, providing a high vantage point. Includes colliders for the "no fall damage" drop glitch to the street.
- **The Lockers & Walkway (Left Flank):** A 2-story walkway structure running behind the towers, providing covered movement.
- **The Long Curve (Right Flank):** A sweeping road/path that flanks the opposite side of the L-shape to bypass the main intersection kill-box.
- **The Jeep ("A" Flag):** A static Humvee/Jeep model placed on the street level acting as hard cover.

## 3. Spawn Logic
- **US Spawn:** Located at the far end of the North-South leg.
- **RU Spawn:** Located at the far end of the East-West leg.
- **Dynamic Flips:** Spawn points will dynamically invert if players push too far into enemy territory.

## 4. Construction Technical Details
- **Modular Grid:** We will continue to use the `3x3` meter modular wall generation from `BuildingGenerator.ts` but arranged into explicit tower footprints rather than a perimeter ring.
- **Elevators:** We will implement simple prismatic Havok joints or Babylon Animations attached to physics bodies to lift players up the shafts.
- **Road:** The ground plane will be swapped from a grassy park to an asphalt road texture matching the L-shape.
