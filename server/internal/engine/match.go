package engine

import (
	"log"
	"math/rand"
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
	playerEntities  []Player
	playerIndices   map[string]int
	cachedGameState *GameState
	cachedServerMsg *ServerMessage
}

func NewMatch() *Match {
	return &Match{
		broadcast:   make(chan Message),
		register:    make(chan *GameSession),
		unregister:  make(chan *GameSession),
		respawnChan: make(chan string),
		sessions:        make(map[*GameSession]bool),
		playerEntities:  make([]Player, 0, 128),
		playerIndices:   make(map[string]int),
		cachedGameState: &GameState{Players: make(map[string]*PlayerState)},
		cachedServerMsg: &ServerMessage{},
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
			stillConnected := false
			for s := range m.sessions {
				if s.PlayerID == session.PlayerID {
					stillConnected = true
					break
				}
			}
			if !stillConnected {
				idx, ok := m.playerIndices[session.PlayerID]
				if ok {
					lastIdx := len(m.playerEntities) - 1
					if idx != lastIdx {
						// Swap last player into deleted spot
						m.playerEntities[idx] = m.playerEntities[lastIdx]
						// Update the moved player's index in the map
						m.playerIndices[m.playerEntities[idx].ID] = idx
					}
					// Pop the last element
					m.playerEntities = m.playerEntities[:lastIdx]
					delete(m.playerIndices, session.PlayerID)
					delete(m.cachedGameState.Players, session.PlayerID)
				}
			}

			log.Printf("Player %s disconnected", session.PlayerID)

		case playerID := <-m.respawnChan:
			idx, ok := m.playerIndices[playerID]
			if ok {
				player := &m.playerEntities[idx]
				if player.State.IsDead {
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
			}

		case message := <-m.broadcast:
			var clientEvent ClientEvent
			if err := proto.Unmarshal(message.Data, &clientEvent); err == nil {

				switch event := clientEvent.Event.(type) {
				case *ClientEvent_StateUpdate:
					// SECURITY FIX: Ignore stateUpdate.ID to prevent spoofing
					idx, ok := m.playerIndices[message.SenderID]
					if !ok {
						newPlayer := NewPlayer(message.SenderID)
						m.playerEntities = append(m.playerEntities, *newPlayer)
						idx = len(m.playerEntities) - 1
						m.playerIndices[message.SenderID] = idx
						m.cachedGameState.Players[message.SenderID] = &PlayerState{}
					}
					player := &m.playerEntities[idx]

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
					targetIdx, okTarget := m.playerIndices[event.Hit.TargetId]
					shooterIdx, okShooter := m.playerIndices[message.SenderID]
                    log.Printf("Received Hit: Shooter=%s, Target=%s, Damage=%d (okTarget=%v, okShooter=%v)", message.SenderID, event.Hit.TargetId, event.Hit.Damage, okTarget, okShooter)

					if okTarget && okShooter {
						target := &m.playerEntities[targetIdx]
						shooter := &m.playerEntities[shooterIdx]
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
					idx, ok := m.playerIndices[message.SenderID]
					if ok {
						shooter := &m.playerEntities[idx]
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
					idx, ok := m.playerIndices[message.SenderID]
					if ok {
						shooter := &m.playerEntities[idx]
						if err := shooter.ValidateAndApplyReload(); err != nil {
							log.Printf("Reload denied from %s: %v", shooter.ID, err)
						}
					}

				case *ClientEvent_SwitchWeapon:
					idx, ok := m.playerIndices[message.SenderID]
					if ok {
						shooter := &m.playerEntities[idx]
						if !shooter.State.IsDead {
							if weapon, wOk := Weapons[event.SwitchWeapon.WeaponId]; wOk {
								shooter.ActiveWeapon = weapon
								shooter.AmmoCount = weapon.MagSize
								shooter.IsReloading = false
							}
						}
					}
				}

			}
		case <-ticker.C:
			// Resolve naturally completed reloads
			now := time.Now()
			for i := range m.playerEntities {
				player := &m.playerEntities[i]
				if player.IsReloading && now.Sub(player.ReloadStart) >= player.ActiveWeapon.ReloadTime {
					player.IsReloading = false
					player.AmmoCount = player.ActiveWeapon.MagSize
				}
			}

			// Update cached broadcast payload
			for i := range m.playerEntities {
				p := &m.playerEntities[i]
				cachedP := m.cachedGameState.Players[p.ID]
				cachedP.X = p.State.X
				cachedP.Y = p.State.Y
				cachedP.Z = p.State.Z
				cachedP.Rx = p.State.Rx
				cachedP.Ry = p.State.Ry
				cachedP.Rz = p.State.Rz
				cachedP.Rw = p.State.Rw
				cachedP.Animation = p.State.Animation
				cachedP.Health = p.State.Health
				cachedP.Kills = p.State.Kills
				cachedP.Deaths = p.State.Deaths
				cachedP.IsDead = p.State.IsDead
				cachedP.PlatformId = p.State.PlatformId
			}
			m.cachedServerMsg.Message = &ServerMessage_GameState{
				GameState: m.cachedGameState,
			}
			stateData, err := proto.Marshal(m.cachedServerMsg)

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
