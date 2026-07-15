package engine

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	networkWriteWait      = 10 * time.Second
	networkPongWait       = 60 * time.Second
	networkPingPeriod     = (networkPongWait * 9) / 10
	maxNetworkMessageSize = 8192
)

// GameSession acts as the bridge between a physical network connection and the active Match.
type GameSession struct {
	match       *Match
	networkConn *websocket.Conn
	outputQueue chan []byte
	PlayerID    string
}

// NewGameSession initializes a new websocket client safely
func NewGameSession(match *Match, conn *websocket.Conn, playerID string) *GameSession {
	return &GameSession{
		match:       match,
		networkConn: conn,
		outputQueue: make(chan []byte, 512), // Kept your friend's increased buffer size
		PlayerID:    playerID,
	}
}

// ListenForPlayerInputs runs continuously in the background, catching packets from the browser.
func (s *GameSession) ListenForPlayerInputs() {
	defer func() {
		s.match.Unregister(s) // Using exported method to maintain clean boundaries
		s.networkConn.Close()
	}()
	s.networkConn.SetReadLimit(maxNetworkMessageSize)
	s.networkConn.SetReadDeadline(time.Now().Add(networkPongWait))
	s.networkConn.SetPongHandler(func(string) error {
		s.networkConn.SetReadDeadline(time.Now().Add(networkPongWait))
		return nil
	})

	for {
		_, message, err := s.networkConn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("network error for player %s: %v", s.PlayerID, err)
			}
			break
		}

		// Broadcast to the match using the exported Broadcast method.
		// Note: The text trimming logic was removed per your friend's update.
		s.match.Broadcast(Message{SenderID: s.PlayerID, Data: message})
	}
}

// StreamUpdatesToPlayer pushes server state updates back to the browser.
func (s *GameSession) StreamUpdatesToPlayer() {
	ticker := time.NewTicker(networkPingPeriod)
	defer func() {
		ticker.Stop()
		s.networkConn.Close()
	}()

	for {
		select {
		case message, ok := <-s.outputQueue:
			s.networkConn.SetWriteDeadline(time.Now().Add(networkWriteWait))
			if !ok {
				// The game engine closed the session cleanly.
				s.networkConn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Kept your friend's update: Sending raw Binary messages for better optimization!
			if err := s.networkConn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			s.networkConn.SetWriteDeadline(time.Now().Add(networkWriteWait))
			if err := s.networkConn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
