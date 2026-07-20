package engine

import (
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
)

// Internal server wrapper to identify who sent a raw network packet
type Message struct {
	SenderID string
	RoomID   string
	Data     []byte
}

type Room struct {
	ID              string
	Name            string
	MapName         string
	PlayerEntities  []Player
	PlayerIndices   map[string]int
	CachedGameState *GameState
	CachedServerMsg *ServerMessage
}

func NewRoom(id string, name string, mapName string) *Room {
	return &Room{
		ID:              id,
		Name:            name,
		MapName:         mapName,
		PlayerEntities:  make([]Player, 0, 128),
		PlayerIndices:   make(map[string]int),
		CachedGameState: &GameState{Players: make(map[string]*PlayerState)},
		CachedServerMsg: &ServerMessage{},
	}
}

type RespawnRequest struct {
	PlayerID string
	RoomID   string
}

// Match maintains the set of active game sessions and orchestrates the game loop.
type Match struct {
	sessions    map[*GameSession]bool // Plain English: Tracking active player sessions
	rooms       map[string]*Room
	roomsMutex  sync.RWMutex
	broadcast   chan Message
	register    chan *GameSession
	unregister  chan *GameSession
	respawnChan chan RespawnRequest
}

func NewMatch() *Match {
	return &Match{
		broadcast:   make(chan Message),
		register:    make(chan *GameSession),
		unregister:  make(chan *GameSession),
		respawnChan: make(chan RespawnRequest),
		sessions:    make(map[*GameSession]bool),
		rooms:       make(map[string]*Room),
	}
}

type RoomInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	MapName    string `json:"map"`
	PlayerCount int   `json:"playerCount"`
}

func (m *Match) CreateRoom(name string, mapName string) *Room {
	id := uuid.New().String()
	room := NewRoom(id, name, mapName)
	
	m.roomsMutex.Lock()
	m.rooms[id] = room
	m.roomsMutex.Unlock()
	
	return room
}

func (m *Match) ListActiveRooms() []RoomInfo {
	m.roomsMutex.RLock()
	defer m.roomsMutex.RUnlock()
	
	rooms := make([]RoomInfo, 0, len(m.rooms))
	for _, room := range m.rooms {
		rooms = append(rooms, RoomInfo{
			ID:          room.ID,
			Name:        room.Name,
			MapName:     room.MapName,
			PlayerCount: len(room.PlayerEntities),
		})
	}
	return rooms
}

func (m *Match) getRoom(roomID string) (*Room, bool) {
	m.roomsMutex.RLock()
	defer m.roomsMutex.RUnlock()
	room, ok := m.rooms[roomID]
	return room, ok
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

func (m *Match) triggerServerRespawn(playerID string, roomID string) {
	// Wait 5 seconds
	time.Sleep(5 * time.Second)
	m.respawnChan <- RespawnRequest{PlayerID: playerID, RoomID: roomID}
}

// Helper to send events without re-locking
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
			if _, ok := m.getRoom(session.RoomID); !ok {
				// Room does not exist, they shouldn't connect normally, but let's just log it.
				log.Printf("Player %s attempting to connect to non-existent room %s", session.PlayerID, session.RoomID)
			}

		case session := <-m.unregister:
			if _, ok := m.sessions[session]; ok {
				delete(m.sessions, session)
				close(session.outputQueue)
			}

			// Zombie fix: Always try to delete player state, even if session was forcefully evicted.
			// To avoid fast-reconnect bugs, ensure no other active session has the same ID.
			stillConnected := false
			for s := range m.sessions {
				if s.PlayerID == session.PlayerID && s.RoomID == session.RoomID {
					stillConnected = true
					break
				}
			}
			if !stillConnected {
				m.roomsMutex.RLock()
				room, ok := m.rooms[session.RoomID]
				m.roomsMutex.RUnlock()
				
				if ok {
					idx, pOk := room.PlayerIndices[session.PlayerID]
					if pOk {
						lastIdx := len(room.PlayerEntities) - 1
						if idx != lastIdx {
							// Swap last player into deleted spot
							room.PlayerEntities[idx] = room.PlayerEntities[lastIdx]
							// Update the moved player's index in the map
							room.PlayerIndices[room.PlayerEntities[idx].ID] = idx
						}
						// Pop the last element
						room.PlayerEntities = room.PlayerEntities[:lastIdx]
						delete(room.PlayerIndices, session.PlayerID)
						delete(room.CachedGameState.Players, session.PlayerID)
					}
				}
			}

			log.Printf("Player %s disconnected from room %s", session.PlayerID, session.RoomID)

		case req := <-m.respawnChan:
			m.roomsMutex.RLock()
			room, ok := m.rooms[req.RoomID]
			m.roomsMutex.RUnlock()
			if ok {
				idx, pOk := room.PlayerIndices[req.PlayerID]
				if pOk {
					player := &room.PlayerEntities[idx]
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
						m.sendDirectEventLocked(req.PlayerID, respawnEvt)
					}
				}
			}

		case message := <-m.broadcast:
			m.roomsMutex.RLock()
			room, ok := m.rooms[message.RoomID]
			m.roomsMutex.RUnlock()
			if !ok {
				continue
			}

			var clientEvent ClientEvent
			if err := proto.Unmarshal(message.Data, &clientEvent); err == nil {

				switch event := clientEvent.Event.(type) {
				case *ClientEvent_StateUpdate:
					// SECURITY FIX: Ignore stateUpdate.ID to prevent spoofing
					idx, ok := room.PlayerIndices[message.SenderID]
					if !ok {
						newPlayer := NewPlayer(message.SenderID)
						room.PlayerEntities = append(room.PlayerEntities, *newPlayer)
						idx = len(room.PlayerEntities) - 1
						room.PlayerIndices[message.SenderID] = idx
						room.CachedGameState.Players[message.SenderID] = &PlayerState{}
					}
					player := &room.PlayerEntities[idx]

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
					targetIdx, okTarget := room.PlayerIndices[event.Hit.TargetId]
					shooterIdx, okShooter := room.PlayerIndices[message.SenderID]
					log.Printf("[Room %s] Received Hit: Shooter=%s, Target=%s, Damage=%d", message.RoomID, message.SenderID, event.Hit.TargetId, event.Hit.Damage)

					if okTarget && okShooter {
						target := &room.PlayerEntities[targetIdx]
						shooter := &room.PlayerEntities[shooterIdx]
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
								go m.triggerServerRespawn(target.ID, room.ID)
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
					idx, ok := room.PlayerIndices[message.SenderID]
					if ok {
						shooter := &room.PlayerEntities[idx]
						if err := shooter.ValidateAndApplyFire(); err == nil {
							// Valid! Broadcast to everyone else IN THIS ROOM
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
									if session.RoomID == message.RoomID && session.PlayerID != message.SenderID {
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
					idx, ok := room.PlayerIndices[message.SenderID]
					if ok {
						shooter := &room.PlayerEntities[idx]
						if err := shooter.ValidateAndApplyReload(); err != nil {
							log.Printf("Reload denied from %s: %v", shooter.ID, err)
						}
					}

				case *ClientEvent_SwitchWeapon:
					idx, ok := room.PlayerIndices[message.SenderID]
					if ok {
						shooter := &room.PlayerEntities[idx]
						if !shooter.State.IsDead {
							if weapon, wOk := Weapons[event.SwitchWeapon.WeaponId]; wOk {
								shooter.ActiveWeapon = weapon
								shooter.AmmoCount = weapon.MagSize
								shooter.IsReloading = false
							}
						}
					}
					
				case *ClientEvent_ThrowGrenade:
					// Broadcast to everyone else IN THIS ROOM
					grenadeMsg := &ServerMessage{
						Message: &ServerMessage_ServerEvent{
							ServerEvent: &ServerEvent{
								Event: &ServerEvent_ThrowGrenade{
									ThrowGrenade: &ServerThrowGrenadeEvent{
										ShooterId: message.SenderID,
										Px:        event.ThrowGrenade.Px,
										Py:        event.ThrowGrenade.Py,
										Pz:        event.ThrowGrenade.Pz,
										Vx:        event.ThrowGrenade.Vx,
										Vy:        event.ThrowGrenade.Vy,
										Vz:        event.ThrowGrenade.Vz,
									},
								},
							},
						},
					}
					if outData, err := proto.Marshal(grenadeMsg); err == nil {
						for session := range m.sessions {
							if session.RoomID == message.RoomID && session.PlayerID != message.SenderID {
								select {
								case session.outputQueue <- outData:
								default:
								}
							}
						}
					}
				}

			}
		case <-ticker.C:
			// Process each room separately
			now := time.Now()
			m.roomsMutex.RLock()
			for _, room := range m.rooms {
				// Resolve naturally completed reloads
				for i := range room.PlayerEntities {
					player := &room.PlayerEntities[i]
					if player.IsReloading && now.Sub(player.ReloadStart) >= player.ActiveWeapon.ReloadTime {
						player.IsReloading = false
						player.AmmoCount = player.ActiveWeapon.MagSize
					}
				}

				// Update cached broadcast payload
				for i := range room.PlayerEntities {
					p := &room.PlayerEntities[i]
					cachedP := room.CachedGameState.Players[p.ID]
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
				room.CachedServerMsg.Message = &ServerMessage_GameState{
					GameState: room.CachedGameState,
				}
				stateData, err := proto.Marshal(room.CachedServerMsg)

				if err == nil {
					for session := range m.sessions {
						if session.RoomID == room.ID {
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
			m.roomsMutex.RUnlock()
		}
	}
}
