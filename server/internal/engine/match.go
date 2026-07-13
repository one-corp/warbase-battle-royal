package engine

import (
	"encoding/json"
	"log"
	"math/rand"
	"sync"
	"time"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Match struct {
	clients    map[*Client]bool
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client

	// Game State
	players map[string]*Player
	mu      sync.Mutex
}

func NewMatch() *Match {
	return &Match{
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		players:    make(map[string]*Player),
	}
}

// Exported methods to allow external HTTP handlers to interact with the Match
func (m *Match) Register(c *Client) {
	m.register <- c
}

func (m *Match) Unregister(c *Client) {
	m.unregister <- c
}

func (m *Match) Broadcast(msg Message) {
	m.broadcast <- msg
}

func (m *Match) triggerServerRespawn(playerID string) {
	// Wait 5 seconds
	time.Sleep(5 * time.Second)

	m.mu.Lock()
	defer m.mu.Unlock()

	player, ok := m.players[playerID]
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

	m.sendDirectEventLocked(playerID, respawnEvt)
}

// Helper to send events without re-locking (must be called inside an m.mu.Lock())
func (m *Match) sendDirectEventLocked(playerID string, event ServerEvent) {
	if outData, err := json.Marshal(event); err == nil {
		for client := range m.clients {
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

func (m *Match) Run() {
	ticker := time.NewTicker(time.Second / 30)
	defer ticker.Stop()

	for {
		select {
		case client := <-m.register:
			m.clients[client] = true

		case client := <-m.unregister:
			if _, ok := m.clients[client]; ok {
				delete(m.clients, client)
				close(client.send)

				m.mu.Lock()
				delete(m.players, client.id)
				m.mu.Unlock()

				log.Printf("Player %s disconnected", client.id)
			}

		case message := <-m.broadcast:
			var event ClientEvent
			if err := json.Unmarshal(message.Data, &event); err == nil {
				m.mu.Lock()

				switch event.Type {
				case "state":
					var stateUpdate PlayerState
					if err := json.Unmarshal(event.Payload, &stateUpdate); err == nil {
						player, ok := m.players[stateUpdate.ID]
						if !ok {
							player = NewPlayer(stateUpdate.ID)
							m.players[stateUpdate.ID] = player
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
						target, okTarget := m.players[hit.Target]
						shooter, okShooter := m.players[message.SenderID]

						if okTarget && okShooter {
							isKill, err := shooter.ValidateAndApplyHit(target, hit.Damage)
							if err == nil {
								// Valid hit! Send feedback to shooter
								if isKill {
									// It was a lethal shot
									m.sendDirectEventLocked(shooter.State.ID, ServerEvent{Type: "kill_confirmed"})
									// Trigger respawn background task for target
									go m.triggerServerRespawn(target.State.ID)
								} else {
									// Normal hit
									m.sendDirectEventLocked(shooter.State.ID, ServerEvent{Type: "hit_confirmed"})
								}
							} else {
								log.Printf("Hit denied from %s: %v", shooter.State.ID, err)
							}
						}
					}

				case "fire":
					shooter, ok := m.players[message.SenderID]
					if ok {
						if err := shooter.ValidateAndApplyFire(); err == nil {
							// Valid! Broadcast to everyone else
							fireMsg := ServerEvent{
								Type:    "fire",
								Payload: FireEvent{Shooter: message.SenderID},
							}
							if outData, err := json.Marshal(fireMsg); err == nil {
								for client := range m.clients {
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
					shooter, ok := m.players[message.SenderID]
					if ok {
						if err := shooter.ValidateAndApplyReload(); err != nil {
							log.Printf("Reload denied from %s: %v", shooter.State.ID, err)
						}
					}

				case "switch":
					var sw SwitchEvent
					if err := json.Unmarshal(event.Payload, &sw); err == nil {
						shooter, ok := m.players[message.SenderID]
						if ok && !shooter.State.IsDead {
							if weapon, wOk := Weapons[sw.WeaponID]; wOk {
								shooter.ActiveWeapon = weapon
								shooter.AmmoCount = weapon.MagSize
								shooter.IsReloading = false
							}
						}
					}
				}

				m.mu.Unlock()
			}
		case <-ticker.C:
			m.mu.Lock()
			// Resolve naturally completed reloads
			now := time.Now()
			for _, player := range m.players {
				if player.IsReloading && now.Sub(player.ReloadStart) >= player.ActiveWeapon.ReloadTime {
					player.IsReloading = false
					player.AmmoCount = player.ActiveWeapon.MagSize
				}
			}

			// Build broadcast payload (only PlayerStates)
			states := make(map[string]*PlayerState)
			for id, p := range m.players {
				states[id] = p.State
			}
			stateData, err := json.Marshal(states)
			m.mu.Unlock()

			if err == nil {
				for client := range m.clients {
					select {
					case client.send <- stateData:
					default:
						close(client.send)
						delete(m.clients, client)
					}
				}
			}
		}
	}
}
