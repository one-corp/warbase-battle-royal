package sync

import (
	"encoding/json"
	"errors"
	"log"
	"math/rand"
	"sync"
	"time"
)

// WeaponConfig defines authoritative weapon properties
type WeaponConfig struct {
	ID         string
	Damage     int
	RPM        int // Fire rate
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

// PlayerState represents the networked player payload sent to clients
type PlayerState struct {
	ID        string  `json:"id"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Z         float64 `json:"z"`
	RotX      float64 `json:"rx"`
	RotY      float64 `json:"ry"`
	RotZ      float64 `json:"rz"`
	RotW      float64 `json:"rw"`
	Animation string  `json:"anim"`
	Health    int     `json:"health"`
	Kills     int     `json:"kills"`
	Deaths    int     `json:"deaths"`
	IsDead    bool    `json:"isDead"`
}

// Player represents the server's authoritative internal view
type Player struct {
	State *PlayerState

	// Authoritative Weapon & Ammo State
	ActiveWeapon WeaponConfig
	AmmoCount    int

	// Timestamps for anti-cheat validation
	LastShotTime time.Time
	IsReloading  bool
	ReloadStart  time.Time
}

func NewPlayer(id string) *Player {
	defaultWeapon := Weapons["ak47"]
	return &Player{
		State: &PlayerState{
			ID:        id,
			Health:    100,
			Animation: "idle",
		},
		ActiveWeapon: defaultWeapon,
		AmmoCount:    defaultWeapon.MagSize,
		LastShotTime: time.Now().Add(-time.Hour), // Ensure they can shoot immediately
	}
}

// Wrapper for incoming client events
type ClientEvent struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type HitEvent struct {
	Target string `json:"target"`
	Damage int    `json:"damage"`
}

type FireEvent struct {
	Shooter string `json:"shooter"`
}

type SwitchEvent struct {
	WeaponID string `json:"weaponId"`
}

type RespawnEvent struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// Wrapper for outgoing server events
type ServerEvent struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Message struct to track sender
type Message struct {
	SenderID string
	Data     []byte
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client

	// Game State
	players map[string]*Player
	mu      sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		players:    make(map[string]*Player),
	}
}

func (p *Player) ValidateAndApplyFire() error {
	if p.State.IsDead {
		return errors.New("dead players cannot shoot")
	}

	now := time.Now()

	// 1. Validate Reload Status
	if p.IsReloading {
		if now.Sub(p.ReloadStart) >= p.ActiveWeapon.ReloadTime {
			// Reload naturally completed
			p.IsReloading = false
			p.AmmoCount = p.ActiveWeapon.MagSize
		} else {
			return errors.New("cannot shoot while reloading")
		}
	}

	// 2. Validate Fire Rate (RPM)
	minInterval := time.Duration(float64(time.Minute) / float64(p.ActiveWeapon.RPM))
	// Add 10ms tolerance for network jitter
	if now.Sub(p.LastShotTime) < (minInterval - 10*time.Millisecond) {
		return errors.New("firing rate exceeds limits (hacking detected)")
	}

	// 3. Validate Ammo
	if p.AmmoCount <= 0 {
		return errors.New("no ammo remaining")
	}

	// Apply
	p.AmmoCount--
	p.LastShotTime = now
	return nil
}

func (p *Player) ValidateAndApplyReload() error {
	if p.State.IsDead {
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

// Returns (isKill, error)
func (p *Player) ValidateAndApplyHit(target *Player, clientDamage int) (bool, error) {
	if p.State.IsDead {
		return false, errors.New("shooter is dead")
	}
	if target.State.IsDead {
		return false, errors.New("target is already dead")
	}
	if p.IsReloading {
		return false, errors.New("shooter was reloading")
	}

	// Basic cheat check: e.g. 3x headshot mult
	maxDamage := int(float64(p.ActiveWeapon.Damage) * 3.0)
	if clientDamage > maxDamage {
		return false, errors.New("impossible damage")
	}

	target.State.Health -= clientDamage
	if target.State.Health <= 0 {
		target.State.Health = 0
		target.State.IsDead = true
		target.State.Deaths++
		target.State.Animation = "death"
		p.State.Kills++
		return true, nil
	}
	return false, nil
}

func (h *Hub) triggerServerRespawn(playerID string) {
	// Wait 5 seconds
	time.Sleep(5 * time.Second)

	h.mu.Lock()
	defer h.mu.Unlock()

	player, ok := h.players[playerID]
	if !ok || !player.State.IsDead {
		return // Disconnected or already revived
	}

	player.State.IsDead = false
	player.State.Health = 100
	player.State.Animation = "idle"
	player.IsReloading = false
	player.AmmoCount = player.ActiveWeapon.MagSize

	// Random spawn point roughly around center
	newX := (rand.Float64() * 20) - 10
	newZ := (rand.Float64() * 20) - 10

	respawnEvt := ServerEvent{
		Type: "respawn",
		Payload: RespawnEvent{
			X: newX,
			Y: 10, // Drop from a bit high
			Z: newZ,
		},
	}

	if outData, err := json.Marshal(respawnEvt); err == nil {
		// Find client and send
		for client := range h.clients {
			if client.id == playerID {
				select {
				case client.send <- outData:
				default:
				}
				break
			}
		}
	}
}

func (h *Hub) sendDirectEvent(playerID string, event ServerEvent) {
	if outData, err := json.Marshal(event); err == nil {
		for client := range h.clients {
			if client.id == playerID {
				select {
				case client.send <- outData:
				default:
				}
				break
			}
		}
	}
}

func (h *Hub) Run() {
	ticker := time.NewTicker(time.Second / 30)
	defer ticker.Stop()

	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)

				h.mu.Lock()
				delete(h.players, client.id)
				h.mu.Unlock()

				log.Printf("Player %s disconnected", client.id)
			}
		case message := <-h.broadcast:
			var event ClientEvent
			if err := json.Unmarshal(message.Data, &event); err == nil {
				h.mu.Lock()

				switch event.Type {
				case "state":
					var stateUpdate PlayerState
					if err := json.Unmarshal(event.Payload, &stateUpdate); err == nil {
						player, ok := h.players[stateUpdate.ID]
						if !ok {
							player = NewPlayer(stateUpdate.ID)
							h.players[stateUpdate.ID] = player
						}

						if player.State.IsDead {
							player.State.Animation = "death"
						} else {
							// Update client-authoritative values (positions, rotations, anim)
							player.State.X = stateUpdate.X
							player.State.Y = stateUpdate.Y
							player.State.Z = stateUpdate.Z
							player.State.RotX = stateUpdate.RotX
							player.State.RotY = stateUpdate.RotY
							player.State.RotZ = stateUpdate.RotZ
							player.State.RotW = stateUpdate.RotW
							player.State.Animation = stateUpdate.Animation
						}
					}

				case "hit":
					var hit HitEvent
					if err := json.Unmarshal(event.Payload, &hit); err == nil {
						target, okTarget := h.players[hit.Target]
						shooter, okShooter := h.players[message.SenderID]

						if okTarget && okShooter {
							isKill, err := shooter.ValidateAndApplyHit(target, hit.Damage)
							if err == nil {
								// Valid hit! Send feedback to shooter
								if isKill {
									// It was a lethal shot
									h.sendDirectEvent(shooter.State.ID, ServerEvent{Type: "kill_confirmed"})
									// Trigger respawn background task for target
									go h.triggerServerRespawn(target.State.ID)
								} else {
									// Normal hit
									h.sendDirectEvent(shooter.State.ID, ServerEvent{Type: "hit_confirmed"})
								}
							} else {
								log.Printf("Hit denied from %s: %v", shooter.State.ID, err)
							}
						}
					}

				case "fire":
					shooter, ok := h.players[message.SenderID]
					if ok {
						if err := shooter.ValidateAndApplyFire(); err == nil {
							// Valid! Broadcast to everyone else
							fireMsg := ServerEvent{
								Type:    "fire",
								Payload: FireEvent{Shooter: message.SenderID},
							}
							if outData, err := json.Marshal(fireMsg); err == nil {
								for client := range h.clients {
									if client.id != message.SenderID {
										select {
										case client.send <- outData:
										default:
										}
									}
								}
							}
						} else {
							log.Printf("Fire denied from %s: %v", shooter.State.ID, err)
						}
					}

				case "reload":
					shooter, ok := h.players[message.SenderID]
					if ok {
						if err := shooter.ValidateAndApplyReload(); err != nil {
							log.Printf("Reload denied from %s: %v", shooter.State.ID, err)
						}
					}

				case "switch":
					var sw SwitchEvent
					if err := json.Unmarshal(event.Payload, &sw); err == nil {
						shooter, ok := h.players[message.SenderID]
						if ok && !shooter.State.IsDead {
							if weapon, wOk := Weapons[sw.WeaponID]; wOk {
								shooter.ActiveWeapon = weapon
								shooter.AmmoCount = weapon.MagSize
								shooter.IsReloading = false
							}
						}
					}
				}

				h.mu.Unlock()
			}
		case <-ticker.C:
			h.mu.Lock()
			// Resolve naturally completed reloads
			now := time.Now()
			for _, player := range h.players {
				if player.IsReloading && now.Sub(player.ReloadStart) >= player.ActiveWeapon.ReloadTime {
					player.IsReloading = false
					player.AmmoCount = player.ActiveWeapon.MagSize
				}
			}

			// Build broadcast payload (only PlayerStates)
			states := make(map[string]*PlayerState)
			for id, p := range h.players {
				states[id] = p.State
			}
			stateData, err := json.Marshal(states)
			h.mu.Unlock()

			if err == nil {
				for client := range h.clients {
					select {
					case client.send <- stateData:
					default:
						close(client.send)
						delete(h.clients, client)
					}
				}
			}
		}
	}
}
