package main

import (
	"log"
	"os"

	"warbase-server/internal/sync"
)

type config struct {
	port int
}

type application struct {
	config config
	logger *log.Logger
	hub    *sync.Hub
}

func main() {
	cfg := config{
		port: 8080,
	}

	logger := log.New(os.Stdout, "", log.Ldate|log.Ltime)

	hub := sync.NewHub()
	go hub.Run()

	app := &application{
		config: cfg,
		logger: logger,
		hub:    hub,
	}

	err := app.serve()
	if err != nil {
		logger.Fatal(err)
	}
}
