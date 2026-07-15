package main

import (
	"net"
	"net/http"
	"warbase-server/internal/engine"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  8192,
	WriteBufferSize: 0, // Disable gorilla's write buffer — flush packets immediately
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all for prototype
	},
}

func (app *application) healthcheckHandler(w http.ResponseWriter, r *http.Request) {
	data := envelope{
		"status": "available",
		"system_info": envelope{
			"environment": app.config.env,
			"version":     "1.0.0",
		},
	}

	err := app.writeJSON(w, http.StatusOK, data, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
}

func (app *application) connectToServerHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Upgrade the http connection to websocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		app.logger.PrintError(err, nil)
		return
	}

	// Disable Nagle's algorithm so small packets (protobuf ~35 bytes) are sent
	// immediately without waiting for TCP buffer to fill up.
	if tcpConn, ok := conn.NetConn().(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)
	}

	// 2. Extract the username:
	username := r.URL.Query().Get("user")
	if username == "" {
		username = "Guest"
	}

	// 3. Create the session:
	session := engine.NewGameSession(app.match, conn, username)

	// 4. Register the session with the central game Match
	app.match.Register(session)

	// 5. Start the network loops in background goroutines
	go session.StreamUpdatesToPlayer()
	go session.ListenForPlayerInputs()
}
