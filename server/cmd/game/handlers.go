package main

import (
	"net/http"
	"warbase-server/internal/engine"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
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

	// 2. Extract the username:
	username := r.URL.Query().Get("user")
	if username == "" {
		username = "Guest"
	}

	// 3. Create the client and register it with Match:
	client := engine.NewClient(app.match, conn, username)

	// 4. Register the client with the central game Match
	app.match.Register(client)

	// 5. Start the network pumps in background goroutines
	go client.WritePump()
	go client.ReadPump()
}
