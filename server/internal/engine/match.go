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

// Match maintains the set of active game sessions and orchestrates the game loop.
type Match struct {
	sessions    map[*GameSession]bool // Plain English: Tracking active player sessions
	broadcast   chan Message
	register    chan *GameSession
	unregister  chan *GameSession
	respawnChan chan string

	// Game State
	players map[string]*Player
	mu      sync.Mutex
}

func NewMatch() *Match {
	return &Match{
		broadcast:   make(chan Message),
		register:    make(chan *GameSession),
		unregister:  make(chan *GameSession),
		respawnChan: make(chan string),
		sessions:    make(map[*GameSession]bool),
		players:     make(map[string]*Player),
	}
}

// Exported methods to allow external HTTP handlers to interact with the Match
func (m *Match) Register(s *GameSession) {
	m.register <- s
}

func (m *Match) Unregister(s *GameSession) {
	m.unregister <- s
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
		for session := range m.sessions {
			if session.PlayerID == playerID {
				select {
				case session.outputQueue <- outData:
				default:
				}
				break
			}
		}
	}
}

func (m *Match) Run() {
	// Your friend upgraded the tick rate to 60Hz!
	ticker := time.NewTicker(time.Second / 60)
	defer ticker.Stop()

	for {
		select {
		case session := <-m.register:
			m.sessions[session] = true

		case session := <-m.unregister:
			if _, ok := m.sessions[session]; ok {
				delete(m.sessions, session)
				close(session.outputQueue)
			}

			// Zombie fix: Always try to delete player state, even if session was forcefully evicted.
			// To avoid fast-reconnect bugs, ensure no other active session has the same ID.
			m.mu.Lock()
			stillConnected := false
			for s := range m.sessions {
				if s.PlayerID == session.PlayerID {
					stillConnected = true
					break
				}
			}
			if !stillConnected {
				delete(m.players, session.PlayerID)
			}
			m.mu.Unlock()

			log.Printf("Player %s disconnected", session.PlayerID)

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
						player.State.PlatformId = event.StateUpdate.PlatformId
					}

				case *ClientEvent_Hit:
					target, okTarget := m.players[event.Hit.TargetId]
					shooter, okShooter := m.players[message.SenderID]
                    log.Printf("Received Hit: Shooter=%s, Target=%s, Damage=%d (okTarget=%v, okShooter=%v)", message.SenderID, event.Hit.TargetId, event.Hit.Damage, okTarget, okShooter)

					if okTarget && okShooter {
						isKill, err := shooter.ValidateAndApplyHit(target, int(event.Hit.Damage))
                        if err != nil {
                            log.Printf("Hit Invalid: %s", err.Error())
                        }
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
								for session := range m.sessions {
									if session.PlayerID != message.SenderID {
										select {
										case session.outputQueue <- outData:
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
				for session := range m.sessions {
					select {
					case session.outputQueue <- stateData:
					default:
						close(session.outputQueue)
						delete(m.sessions, session)
					}
				}
			}
		}
	}
}
