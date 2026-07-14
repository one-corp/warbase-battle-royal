package engine

import (
	"log"
	"math/rand"
	"sync"
	"time"

	"google.golang.org/protobuf/proto"
)

// Internal server wrapper to identify who sent a raw network packet
type Message struct {
	SenderID string
	Data     []byte
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Match struct {
	clients     map[*Client]bool
	broadcast   chan Message
	register    chan *Client
	unregister  chan *Client
	respawnChan chan string

	// Game State
	players map[string]*Player
	mu      sync.Mutex
}

func NewMatch() *Match {
	return &Match{
		broadcast:   make(chan Message),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		respawnChan: make(chan string),
		clients:     make(map[*Client]bool),
		players:     make(map[string]*Player),
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
	m.respawnChan <- playerID
}

// Helper to send events without re-locking (must be called inside an m.mu.Lock())
func (m *Match) sendDirectEventLocked(playerID string, event *ServerMessage) {
	if outData, err := proto.Marshal(event); err == nil {
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
	ticker := time.NewTicker(time.Second / 60)
	defer ticker.Stop()

	for {
		select {
		case client := <-m.register:
			m.clients[client] = true

		case client := <-m.unregister:
			if _, ok := m.clients[client]; ok {
				delete(m.clients, client)
				close(client.send)
			}

			// Zombie fix: Always try to delete player state, even if client was forcefully evicted.
			// To avoid fast-reconnect bugs, ensure no other active client has the same ID.
			m.mu.Lock()
			stillConnected := false
			for c := range m.clients {
				if c.id == client.id {
					stillConnected = true
					break
				}
			}
			if !stillConnected {
				delete(m.players, client.id)
			}
			m.mu.Unlock()

			log.Printf("Player %s disconnected", client.id)

		case playerID := <-m.respawnChan:
			m.mu.Lock()
			player, ok := m.players[playerID]
			if ok && player.State.IsDead {
				player.State.IsDead = false
				player.State.Health = 100
				player.State.Animation = "idle"
				player.IsReloading = false
				player.AmmoCount = player.ActiveWeapon.MagSize

				newX := (rand.Float64() * 6) - 3
				newZ := (rand.Float64() * 6) - 3

				respawnEvt := &ServerMessage{
					Message: &ServerMessage_ServerEvent{
						ServerEvent: &ServerEvent{
							Event: &ServerEvent_Respawn{
								Respawn: &RespawnEvent{
									X: float32(newX),
									Y: 10,
									Z: float32(newZ),
								},
							},
						},
					},
				}
				m.sendDirectEventLocked(playerID, respawnEvt)
			}
			m.mu.Unlock()

		case message := <-m.broadcast:
			var clientEvent ClientEvent
			if err := proto.Unmarshal(message.Data, &clientEvent); err == nil {
				m.mu.Lock()

				switch event := clientEvent.Event.(type) {
				case *ClientEvent_StateUpdate:
					// SECURITY FIX: Ignore stateUpdate.ID to prevent spoofing
					player, ok := m.players[message.SenderID]
					if !ok {
						player = NewPlayer(message.SenderID)
						m.players[message.SenderID] = player
					}

					if player.State.IsDead {
						player.State.Animation = "death"
					} else {
						// Update client-authoritative values (positions, rotations, anim)
						player.State.X = event.StateUpdate.X
						player.State.Y = event.StateUpdate.Y
						player.State.Z = event.StateUpdate.Z
						player.State.Rx = event.StateUpdate.Rx
						player.State.Ry = event.StateUpdate.Ry
						player.State.Rz = event.StateUpdate.Rz
						player.State.Rw = event.StateUpdate.Rw
						player.State.Animation = event.StateUpdate.Animation
					}

				case *ClientEvent_Hit:
					target, okTarget := m.players[event.Hit.TargetId]
					shooter, okShooter := m.players[message.SenderID]

					if okTarget && okShooter {
						isKill, err := shooter.ValidateAndApplyHit(target, int(event.Hit.Damage))
						if err == nil {
							// Valid hit! Send feedback to shooter
							if isKill {
								// It was a lethal shot
								m.sendDirectEventLocked(shooter.ID, &ServerMessage{
									Message: &ServerMessage_ServerEvent{
										ServerEvent: &ServerEvent{
											Event: &ServerEvent_KillConfirmed{},
										},
									},
								})
								// Trigger respawn background task for target
								go m.triggerServerRespawn(target.ID)
							} else {
								// Normal hit
								m.sendDirectEventLocked(shooter.ID, &ServerMessage{
									Message: &ServerMessage_ServerEvent{
										ServerEvent: &ServerEvent{
											Event: &ServerEvent_HitConfirmed{},
										},
									},
								})
							}
						} else {
							log.Printf("Hit denied from %s: %v", shooter.ID, err)
						}
					}

				case *ClientEvent_Fire:
					shooter, ok := m.players[message.SenderID]
					if ok {
						if err := shooter.ValidateAndApplyFire(); err == nil {
							// Valid! Broadcast to everyone else
							fireMsg := &ServerMessage{
								Message: &ServerMessage_ServerEvent{
									ServerEvent: &ServerEvent{
										Event: &ServerEvent_Fire{
											Fire: &ServerFireEvent{
												ShooterId: message.SenderID,
											},
										},
									},
								},
							}
							if outData, err := proto.Marshal(fireMsg); err == nil {
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
							log.Printf("Fire denied from %s: %v", shooter.ID, err)
						}
					}

				case *ClientEvent_Reload:
					shooter, ok := m.players[message.SenderID]
					if ok {
						if err := shooter.ValidateAndApplyReload(); err != nil {
							log.Printf("Reload denied from %s: %v", shooter.ID, err)
						}
					}

				case *ClientEvent_SwitchWeapon:
					shooter, ok := m.players[message.SenderID]
					if ok && !shooter.State.IsDead {
						if weapon, wOk := Weapons[event.SwitchWeapon.WeaponId]; wOk {
							shooter.ActiveWeapon = weapon
							shooter.AmmoCount = weapon.MagSize
							shooter.IsReloading = false
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
			gameState := &GameState{
				Players: make(map[string]*PlayerState),
			}
			for id, p := range m.players {
				gameState.Players[id] = &PlayerState{
					X:         p.State.X,
					Y:         p.State.Y,
					Z:         p.State.Z,
					Rx:        p.State.Rx,
					Ry:        p.State.Ry,
					Rz:        p.State.Rz,
					Rw:        p.State.Rw,
					Animation: p.State.Animation,
					Health:    p.State.Health,
					Kills:     p.State.Kills,
					Deaths:    p.State.Deaths,
					IsDead:    p.State.IsDead,
				}
			}
			serverMsg := &ServerMessage{
				Message: &ServerMessage_GameState{
					GameState: gameState,
				},
			}
			stateData, err := proto.Marshal(serverMsg)
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
