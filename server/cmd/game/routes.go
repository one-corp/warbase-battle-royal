package main

import (
	"net/http"
	"net/http/pprof"
)

func (app *application) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/healthcheck", app.healthcheckHandler)
	mux.HandleFunc("/connect", app.connectToServerHandler)
	
	mux.HandleFunc("/api/rooms", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			app.listRoomsHandler(w, r)
		} else if r.Method == http.MethodPost {
			app.createRoomHandler(w, r)
		} else {
			app.methodNotAllowedResponse(w, r)
		}
	})

	// Profiling endpoints
	mux.HandleFunc("/debug/pprof/", pprof.Index)
	mux.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
	mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
	mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
	mux.HandleFunc("/debug/pprof/trace", pprof.Trace)

	// Serve the compiled Vite frontend from ../client/dist
	fileServer := http.FileServer(http.Dir("../client/dist"))
	mux.Handle("/", fileServer)

	return mux
}
