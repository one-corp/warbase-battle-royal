package main

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

// PlayerState represents the networked player
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

// Wrapper for outgoing server events (if we need to send specific events to one client)
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
	players map[string]*PlayerState
	mu      sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		players:    make(map[string]*PlayerState),
	}
}

func (h *Hub) run() {
	// Start the game loop tick at 30Hz
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
					var state PlayerState
					if err := json.Unmarshal(event.Payload, &state); err == nil {
						// Preserve server-authoritative fields (health, kills, deaths, isDead)
						if existing, ok := h.players[state.ID]; ok {
							state.Health = existing.Health
							state.Kills = existing.Kills
							state.Deaths = existing.Deaths
							state.IsDead = existing.IsDead
						} else {
							// New player init
							state.Health = 100
						}
						
						// If dead, ignore position updates (prevent moving while dead)
						if state.IsDead {
							h.players[state.ID].Animation = "death"
						} else {
							h.players[state.ID] = &state
						}
					}
					
				case "hit":
					var hit HitEvent
					if err := json.Unmarshal(event.Payload, &hit); err == nil {
						target, okTarget := h.players[hit.Target]
						shooter, okShooter := h.players[message.SenderID]
						
						if okTarget && !target.IsDead {
							target.Health -= hit.Damage
							if target.Health <= 0 {
								target.Health = 0
								target.IsDead = true
								target.Deaths++
								target.Animation = "death"
								
								if okShooter {
									shooter.Kills++
								}
								
								// Optional: you could send a direct message to the dead client to trigger respawn UI
								// but broadcasting the state with IsDead=true is enough for the client to handle it.
							}
						}
					}
					
				case "respawn":
					// Client requested respawn after dying
					if player, ok := h.players[message.SenderID]; ok {
						if player.IsDead {
							player.IsDead = false
							player.Health = 100
							player.Animation = "idle"
						}
					}
					
				case "fire":
					// Instant broadcast to all OTHER clients so they can render muzzle flash
					// We construct a new wrapper to send to clients
					fireMsg := ServerEvent{
						Type: "fire",
						Payload: FireEvent{
							Shooter: message.SenderID,
						},
					}
					
					if outData, err := json.Marshal(fireMsg); err == nil {
						for client := range h.clients {
							if client.id != message.SenderID {
								select {
								case client.send <- outData:
								default:
									close(client.send)
									delete(h.clients, client)
								}
							}
						}
					}
				}
				
				h.mu.Unlock()
			}
		case <-ticker.C:
			// Broadcast unified state to all clients at 30Hz
			h.mu.Lock()
			stateData, err := json.Marshal(h.players)
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
