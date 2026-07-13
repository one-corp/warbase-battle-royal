package main

import (
	"net/http"
)

func (app *application) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthcheck", app.healthcheckHandler)
	mux.HandleFunc("/connect", app.connectToServerHandler)

	// Serve the compiled Vite frontend from ../client/dist
	fileServer := http.FileServer(http.Dir("../client/dist"))
	mux.Handle("/", fileServer)

	return mux
}
