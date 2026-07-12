package main

import (
	"net/http"

	"warbase-server/internal/sync"
)

func (app *application) healthcheckHandler(w http.ResponseWriter, r *http.Request) {
	data := map[string]string{
		"status":      "available",
		"environment": "development",
		"version":     "1.0.0",
	}

	err := writeJSON(w, http.StatusOK, data, nil)
	if err != nil {
		app.logger.Println(err)
		http.Error(w, "The server encountered a problem and could not process your request", http.StatusInternalServerError)
	}
}

func (app *application) wsHandler(w http.ResponseWriter, r *http.Request) {
	sync.ServeWs(app.hub, w, r)
}
