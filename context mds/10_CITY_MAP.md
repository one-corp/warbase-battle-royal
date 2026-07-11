# WarBase City Map Blueprint

This document tracks the precise mathematical coordinates and layout of the city map to ensure pixel-perfect accuracy for all generated assets.

## 1. Global Coordinates
- **Center of Map:** `(0, 0, 0)`
- **Perimeter Ring (Buildings):** A perfect square surrounding the park.
- **Perimeter Radius:** `41` meters from the center.

## 2. Building Grid Math
Buildings are generated procedurally using a modular grid of `3x3` meter tiles.

### Dimensions
- **Tile Size:** `3.0` meters
- **Wall Thickness:** `0.3` meters
- **Building Width:** `4` tiles = `12.0` meters
- **Building Depth:** `4` tiles = `12.0` meters

### Top Wall Buildings (North)
- **Center Z Coordinate:** `41.0`
- **Front Wall (facing center):** 
  - Centered at `Z = 41.0 - 6.0 = 35.0`
  - Because the wall is `0.3m` thick, its true physical exterior edge is at `Z = 35.0 - 0.15 = 34.85`
- **Face Direction:** `(0, 0, -1)`

### Bottom Wall Buildings (South)
- **Center Z Coordinate:** `-41.0`
- **Front Wall (facing center):**
  - Centered at `Z = -41.0 + 6.0 = -35.0`
  - Physical exterior edge at `Z = -35.0 + 0.15 = -34.85`
- **Face Direction:** `(0, 0, 1)`

### Left Wall Buildings (West)
- **Center X Coordinate:** `-41.0`
- **Front Wall (facing center):**
  - Centered at `X = -41.0 + 6.0 = -35.0`
  - Physical exterior edge at `X = -35.0 + 0.15 = -34.85`
- **Face Direction:** `(1, 0, 0)`

### Right Wall Buildings (East)
- **Center X Coordinate:** `41.0`
- **Front Wall (facing center):**
  - Centered at `X = 41.0 - 6.0 = 35.0`
  - Physical exterior edge at `X = 35.0 - 0.15 = 34.85`
- **Face Direction:** `(-1, 0, 0)`

## 3. The Neon Sign Bug (Root Cause)
The neon signs were placed `0.05m` outwards from the mathematical edge of the building grid (`12m / 2 = 6m`). 
For a North building at `41.0`, the sign was placed at `41.0 - 6.05 = 34.95`.
However, because the wall is a physical 3D box with `0.3m` thickness, it extends from `34.85` to `35.15`.
**Conclusion:** The neon signs were mathematically spawning exactly **inside** the solid concrete walls!
