# Multiplayer FPS Server Architecture (Go & Babylon.js)

This document is a comprehensive guide for building the Go game server backend for our Babylon.js WebGPU FPS. It covers the exact network payloads, architectural paradigms, server loops, anti-cheat validation (hits, reloads, fire rates), and best practices for writing high-performance game servers in Go.

---

## 1. High-Level Architecture & Server Structure

The game operates on a **Client-Server** model using **WebSockets**. WebRTC (UDP) is often preferred for fast-paced games, but WebSockets (TCP) are much easier to implement and are perfectly viable for web-based games if the payload size and tick rates are managed correctly.

*   **Protocol:** WebSockets (`gorilla/websocket` in Go is highly recommended).
*   **Route & Handler:** Clients connect via the `/connect` endpoint.
*   **Tick Rate:** 30Hz (The server broadcasts state 30 times per second).
*   **Format:** Protobuf (Binary). JSON was previously used for prototyping, but Protobuf is now strictly enforced for minimal bandwidth and maximum parsing speed.

### Production-Ready Features
*   **Binary Payloads:** All communication is strictly encoded via Protobuf schemas (`packets.proto`).
*   **Graceful Shutdown:** Implemented to catch OS signals (like SIGINT/SIGTERM), allowing the server to finish processing active ticks, safely disconnect clients, and clean up resources before exiting.

### Directory Structure (Standard Go Layout)
The server follows the idiomatic Go project layout for better separation of concerns:
*   `cmd/game/`: Contains the main application entry point and server initialization.
*   `internal/`: Houses the private application and domain logic.
    *   `internal/engine/`: Core game loop, state management, WebSocket connections, Match logic, and Player handling.
    *   `internal/proto/`: Auto-generated Protobuf Go bindings.

### Concurrency Model in Go
The Go server should use a standard concurrent Match pattern:
*   **1 Match Goroutine:** Manages the game loop (tick rate), global game state, and broadcasting via a `respawnChan` and state broadcast loop.
*   **2 Goroutines per Client:** One `readPump` (listening for incoming WebSocket messages) and one `writePump` (flushing outgoing messages to the socket).
*   **Channels:** The `readPump` sends parsed actions to the Match via channels to avoid locking the game state with Mutexes whenever possible.

---

## 2. Payload Schemas & Protocols (Protobuf)

All communication happens via Binary Protobuf messages defined in `packets.proto`.

### From Client -> To Server (`ClientEvent`)

**1. Movement State Update (Sent continuously by client)**
```protobuf
message PlayerStateUpdate {
    float x = 1; float y = 2; float z = 3;
    float rx = 4; float ry = 5; float rz = 6; float rw = 7;
    string animation = 8;
    optional string platform_id = 9; // Used for relative local-space coordinates on moving platforms
}
```

**2. Combat Event: Firing (Sent instantly when clicking)**
```protobuf
message ClientFireEvent {
    // Empty, implies local player fired
}
```

**3. Combat Event: Hit Registration (Sent instantly when the client's raycast hits an enemy)**
```protobuf
message ClientHitEvent {
    string target_id = 1;
    int32 damage = 2;
}
```

### From Server -> To Client (`ServerMessage`)

**1. The 30Hz Global State Broadcast**
Every 33ms, the server packages the state of ALL players and sends it to everyone.
```protobuf
message GameStateBroadcast {
    map<string, PlayerState> players = 1;
}

message PlayerState {
    float x = 1; float y = 2; float z = 3;
    float rx = 4; float ry = 5; float rz = 6; float rw = 7;
    string animation = 8;
    optional string platform_id = 9;
    int32 health = 10;
    int32 kills = 11;
    int32 deaths = 12;
    bool is_dead = 13;
}
```

**2. Instant Event Broadcasts (Relayed immediately, bypassing the 30Hz loop)**
When Client A sends a `"fire"` or `"reload"` event, the server instantly sends this to Clients B, C, etc.
```json
{
  "type": "fire",
  "playerId": "player-uuid-123"
}
```

---

## 3. The 30Hz Game Loop (The Match)

To keep all browsers in sync without lagging the server, the Go Server runs a massive "Tick" exactly 30 times a second.

```go
func (m *Match) Run() {
    ticker := time.NewTicker(time.Second / 30) // 30 Hz Tick
    defer ticker.Stop()

    for {
        select {
        case client := <-h.register:
            h.clients[client] = true
            
        case client := <-h.unregister:
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
            }
            
        case message := <-h.broadcast:
            // Route instantaneous events like "fire" immediately
            for client := range h.clients {
                client.send <- message
            }
            
        case <-ticker.C:
            // 30Hz TICK: Broadcast the aggregated global game state
            gameState := h.buildGameStatePayload()
            for client := range h.clients {
                client.send <- gameState
            }
        }
    }
}
```

---

## 4. Authoritative Domains (Who controls what?)

Game networking is a balance of trusting the client (for responsiveness) vs trusting the server (for security).

### A. Client-Authoritative Hit Detection
We use **Client-Authoritative** hit detection. This is standard for fast web shooters (Krunker, Bullet Force) because it guarantees zero latency when shooting.
*   **How it works:** If you click and your crosshair is on an enemy on *your* screen, it's a guaranteed hit. The client tells the server `"I hit Player B for 34 damage."`
*   **Why?** If we used Server-Authoritative hit detection, you would have to "lead" your shots to account for your ping, which feels terrible in a hitscan FPS.
*   **The Go Server's Job:** Validate the hit, BUT do basic sanity checks (e.g., Is the shooter dead? Is the target already dead? Is the damage value absurdly high?).

### B. Server-Authoritative Health & Death
While the client decides *if* a hit lands, the **Go Server is the absolute authority on Health, Kills, Deaths, and whether a player is alive or dead.**

**The Combat Resolution Flow in Go:**
1.  **Receive Hit:** The server receives the `hit` payload.
2.  **Validate:** The server checks `if !target.IsDead`. You cannot deal damage to a dead player.
3.  **Apply Damage:** The server subtracts the damage from the target's Health.
4.  **Death Trigger:** If Health drops to 0 or below, the server overrides the player's state:
    *   Sets `Health = 0`
    *   Sets `IsDead = true`
    *   Increments Target's `Deaths`, Increments Shooter's `Kills`
    *   Forcefully overrides their animation state to `"death"`.
5.  **Ghost Prevention (CRITICAL):** Once the server marks a player as dead (`IsDead = true`), **it must completely drop and ignore any further position updates sent by that client's WebSocket**. This prevents a dead player's client from moving around as a ghost on other screens while waiting to respawn.
6.  **Server-Initiated Respawn:** The server runs a background timer (e.g. 5 seconds) for the dead player. Once it expires, the server selects a random spawn point, sets `Health = 100`, sets `IsDead = false`, and sends a one-off `"type": "respawn"` packet to the client with the new coordinates, forcing them back into the fight.

---

## 5. Pro-Level Security & Anti-Cheat Validation

If you blindly accept `"fire"` and `"hit"` messages from clients, hackers will inject packets to shoot infinitely, reload instantly, and hit every player from across the map. A professional game server must validate client actions against an **internal simulation**.

Here is how the Go server must authoritatively validate actions:

### A. Firing Rate Validation
Clients can modify their local fire rates to make an AK47 shoot like a minigun. The server must validate the interval between shots.
*   **The Rule:** A weapon has a fire rate (RPM). The minimum time between shots is calculated as:
    $$\Delta t_{\text{min}} = \frac{60 \text{ seconds}}{\text{RPM}}$$
    For the AK47 (600 RPM), $\Delta t_{\text{min}} = 100\text{ms}$.
*   **The Validation:** Keep a `LastShotTime` timestamp for each player. When a `"fire"` packet arrives, verify:
    $$\text{CurrentTime} - \text{LastShotTime} \ge \Delta t_{\text{min}} - \text{latencyTolerance}$$
    If a client sends fire events faster than this, drop the packet and flag them for hacking.

### B. Authoritative Ammo & Reload Validation
If a client never sends a reload packet but keeps shooting, or sends reload packets that complete instantly, they have infinite ammo.
*   **The Rule:** The server maintains an authoritative `AmmoCount` and a `Reloading` state.
*   **The Sequence:**
    1.  **Shooting:** When a `"fire"` packet is validated, the server decrements that player's `AmmoCount` by 1. If `AmmoCount == 0` or the player is currently `Reloading`, the server **drops any incoming `"hit"` packets** from that player.
    2.  **Reload Start:** When the client sends `"reload"`, the server sets `Reloading = true`, records `ReloadStartTime = CurrentTime`, and verifies if the player actually has ammo reserves left to reload.
    3.  **Reload Complete:** The player is locked from shooting/hitting for the weapon's `reloadTime` (e.g. 2.5s for AK47). If a `"hit"` packet is received during this lock window, it is ignored. Once `CurrentTime - ReloadStartTime >= reloadTime`, the server sets `Reloading = false` and refills `AmmoCount = magSize`.

### C. Weapon Switch Validation
If a client claims to switch from a pistol to an AK47, the server must verify:
*   Does the player actually own or have the AK47 equipped in their loadout?
*   Did they wait out the switch delay (draw time) before firing the new weapon?

### D. Hitmarker & Kill Confirmation
When a client sends a `"hit"` packet, the shooter's UI does not immediately show a kill marker.
*   **The Resolution:** The server processes the hit and subtracts the health.
*   **The Feedback Loop:** If the target survives, the server replies with an instant `"type": "hit_confirmed"` packet. If the target's health reaches 0, the server replies with a `"type": "kill_confirmed"` packet. This ensures the client's UI (crosshair flashes, hit sounds) perfectly match the authoritative server state.

---

## 6. Go Server Implementation Blueprint

Here is a concrete blueprint of how to implement the authoritative data structures and validation functions in Go.

```go
package game

import (
	"errors"
	"math"
	"time"
)

// WeaponConfig defines authoritative weapon properties
type WeaponConfig struct {
	ID         string
	Damage     int
	RPM        int           // Fire rate
	MagSize    int
	ReloadTime time.Duration // e.g. 2500ms
}

var Weapons = map[string]WeaponConfig{
	"ak47": {
		ID:         "ak47",
		Damage:     34,
		RPM:        600,
		ReloadTime: 2500 * time.Millisecond,
		MagSize:    30,
	},
	"pistol": {
		ID:         "pistol",
		Damage:     25,
		RPM:        400,
		ReloadTime: 1500 * time.Millisecond,
		MagSize:    12,
	},
}

// Player represents the server's authoritative view of a client
type Player struct {
	ID            string
	Health        int
	Kills         int
	Deaths        int
	IsDead        bool
	
	// Authoritative Weapon & Ammo State
	ActiveWeapon  WeaponConfig
	AmmoCount     int
	
	// Timestamps for anti-cheat validation
	LastShotTime  time.Time
	IsReloading   bool
	ReloadStart   time.Time
}

func NewPlayer(id string) *Player {
	defaultWeapon := Weapons["ak47"]
	return &Player{
		ID:           id,
		Health:       100,
		ActiveWeapon: defaultWeapon,
		AmmoCount:    defaultWeapon.MagSize,
	}
}

// ValidateAndApplyFire checks fire rate and ammo levels before broadcasting
func (p *Player) ValidateAndApplyFire() error {
	if p.IsDead {
		return errors.New("dead players cannot shoot")
	}
	
	now := time.Now()
	
	// 1. Validate Reload Status
	if p.IsReloading {
		if now.Sub(p.ReloadStart) >= p.ActiveWeapon.ReloadTime {
			// Reload has naturally completed, resolve state
			p.IsReloading = false
			p.AmmoCount = p.ActiveWeapon.MagSize
		} else {
			return errors.New("cannot shoot while reloading")
		}
	}
	
	// 2. Validate Fire Rate (RPM)
	minInterval := time.Duration(float64(time.Minute) / float64(p.ActiveWeapon.RPM))
	// Add a small 10ms tolerance for network jitter
	if now.Sub(p.LastShotTime) < (minInterval - 10*time.Millisecond) {
		return errors.New("firing rate exceeds limits (hacking detected)")
	}
	
	// 3. Validate Ammo
	if p.AmmoCount <= 0 {
		return errors.New("no ammo remaining, must reload")
	}
	
	// Apply changes
	p.AmmoCount--
	p.LastShotTime = now
	return nil
}

// ValidateAndApplyReload initiates the reload lock timer
func (p *Player) ValidateAndApplyReload() error {
	if p.IsDead {
		return errors.New("dead players cannot reload")
	}
	if p.IsReloading {
		return errors.New("already reloading")
	}
	if p.AmmoCount == p.ActiveWeapon.MagSize {
		return errors.New("magazine already full")
	}
	
	p.IsReloading = true
	p.ReloadStart = time.Now()
	return nil
}

// ValidateAndApplyHit verifies hit validation and deals damage
func (p *Player) ValidateAndApplyHit(target *Player, clientDamage int) (bool, error) {
	if p.IsDead {
		return false, errors.New("dead players cannot deal damage")
	}
	if target.IsDead {
		return false, errors.New("target is already dead")
	}
	
	// Check if shooter has ammo, or is currently reloading
	if p.IsReloading {
		return false, errors.New("ignored hit: shooter was reloading")
	}
	
	// Check weapon damage bounds (e.g. no cheat damage multipliers)
	maxPossibleDamage := int(float64(p.ActiveWeapon.Damage) * 3.0) // 3x max for headshot multiplier
	if clientDamage > maxPossibleDamage {
		return false, errors.New("impossible damage amount (hacking detected)")
	}
	
	// Apply damage
	target.Health -= clientDamage
	if target.Health <= 0 {
		target.Health = 0
		target.IsDead = true
		target.Deaths++
		p.Kills++
		return true, nil // Returns true to trigger a Death/Kill confirmation
	}
	
	return false, nil
}
```

---

## 7. Client Interpolation & Animation Locking

Because the server only sends updates at 30Hz (every 33ms), moving players instantly to those coordinates would look choppy on a 60Hz or 144Hz monitor.

**Interpolation:**
The Babylon.js client receives the 30Hz state. Instead of instantly teleporting the remote players, it pushes the coordinates into a `stateBuffer` (an array of recent positions). The client then smoothly glides (interpolates) the 3D meshes between these buffered points. The Go server doesn't need to worry about this—just send the raw coordinates reliably at 30Hz!

**Animation Locking (The Firing Problem):**
When a client shoots, the Go server instantly relays the `"fire"` event. The receiving clients play a muzzle flash and a firing recoil animation.
However, 10ms later, the 30Hz state packet might arrive saying that player's animation is `"run"`, instantly cancelling the firing animation!
*   **The Client Solution:** The Babylon.js client implements a **250ms Animation Lock**. When a `"fire"` event is received, the client forces the firing animation to play and actively ignores the `anim` field from the 30Hz server tick for 250ms, giving the recoil animation time to finish visually.

---

## 8. Advanced Networking: The "Pro" Level Features

To elevate this server from a prototype to a massive production-ready game engine, implement these advanced industry standards:

### A. Anti-Speedhack (Movement Validation)
Because we use Client-Authoritative movement, a hacker can modify their client to send coordinates that teleport them across the map or move at 5x speed.
*   **The Validation:** The server must validate the distance moved between ticks.
*   **The Math:** `Speed = Distance(CurrentPos, LastPos) / (CurrentTime - LastTime)`. If `Speed > PlayerMaxWalkSpeed + Tolerance`, drop the movement packet and force the client to snap back to their `LastPos` (a "Rubberband" correction).

### B. Serialization & Bandwidth Optimization
JSON is incredibly bloated for 30Hz game state transmission. Sending `{ "x": 12.53421, "y": 0.5231, "z": -4.2123 }` takes ~45 bytes per player, per tick.
*   **Protocol Buffers (Protobuf) / FlatBuffers:** Switch to binary serialization. A Vector3 in binary takes only 12 bytes (3x 32-bit floats).
*   **Delta Compression:** Instead of sending the absolute position every tick, the server only sends the *change* (delta) since the last tick. If a player is standing still, the server sends exactly 0 bytes for their movement.

### C. Spatial Partitioning (Area of Interest)
If you have 100 players on a large map, sending the state of 99 other players to every client at 30Hz will bottleneck the server's network bandwidth ($O(N^2)$ scaling).
*   **The Solution:** Divide the map into a Grid or Octree. The server only sends state updates to a client for entities that exist in the same or adjacent grid cells. If a player is far away, the server ceases state transmission for them.

### D. Dead Reckoning & Extrapolation
What happens if the client experiences a lag spike and misses a 30Hz tick? The interpolated characters will freeze in place and look terrible.
*   **The Solution:** Implement Dead Reckoning. If a packet is missed, the client looks at the player's last known velocity and *extrapolates* (predicts) where they should be moving, keeping the animation smooth until the next packet arrives to correct the position.

### E. Matchmaking & Room Architecture in Go
A single `Match` struct works for one active game, but real environments need hundreds of matches running simultaneously.
*   **The Architecture:** 
    1.  A global `Lobby` API handles authentication, queuing, and matchmaking.
    2.  When a game is found, the lobby spawns a new Go Goroutine running a completely isolated `Match` (a Game Room).
    3.  The players' WebSockets are handed off to this specific Game Room.
    4.  When the match ends, the Game Room Goroutine cleanly shuts down and the memory is reclaimed by the Garbage Collector.

### F. Clock Synchronization (NTP)
For accurate lag compensation and packet timestamping, the server and client need a synchronized clock, often implemented via a custom RTT (Round Trip Time) ping-pong mechanism during the initial WebSocket handshake.

---

## 9. Required Reading for Game Server Engineering

To master the concepts above, there are three "holy grail" resources that form the foundation of modern game networking. Reading these will provide the equivalent of a Master's degree in Game Server Networking:

### A. Valve's Source Multiplayer Networking
This is the single most important document for an FPS developer. Valve (creators of Counter-Strike and Half-Life) published exactly how their engine handles networking, lag compensation, hit detection, and entity interpolation. It's the industry standard that almost every modern shooter copies.
*   **Link:** [Source Multiplayer Networking (Valve Developer Community)](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)
*   **Why read it:** It perfectly explains the concepts of "Tickrate", "Interpolation Delay", and why the server always needs to be authoritative.

### B. Gaffer on Games: Networked Physics Series
Glenn Fiedler is an absolute legend in game network programming. His website is basically a textbook for building multiplayer engines.
*   **Link:** [Gaffer on Games: Networked Physics](https://gafferongames.com/post/networked_physics_2004/) (and his broader Game Networking Series)
*   **Why read it:** It breaks down the math behind client-side prediction, how to sync physics over a network, and the tradeoffs between sending inputs vs. sending snapshot states. His article "Fix Your Timestep" is required reading for writing any game loop.

### C. Gorilla WebSocket Chat Example (Go-Specific)
Since this backend is built in Go, the `gorilla/websocket` library is the gold standard. The official chat example provided in their repository is the exact concurrency pattern outlined in our blueprint (adapted from Hub to Match).
*   **Link:** [Gorilla WebSocket Chat Example](https://github.com/gorilla/websocket/tree/master/examples/chat)
*   **Why read it:** It shows the mathematically perfect, lock-free way to build a Go server with a `Match` struct, `Client` structs, and channels for `readPumps` and `writePumps`. Using this architecture as the base for the game server will allow it to comfortably handle thousands of concurrent players without deadlocking or crashing.
