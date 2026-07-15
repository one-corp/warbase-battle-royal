package main

import (
	"flag"
	"os"
	"sync"

	"warbase-server/internal/engine"
	"warbase-server/internal/jsonlog"
)

type config struct {
	port int
	env  string
}

type application struct {
	config config
	logger *jsonlog.Logger
	match  *engine.Match
	wg     sync.WaitGroup
}

func main() {
	var cfg config

	flag.IntVar(&cfg.port, "port", 8080, "Game server port")
	flag.StringVar(&cfg.env, "env", "development", "Environment (Development | Production)")

	flag.Parse()

	logger := jsonlog.New(os.Stdout, jsonlog.LevelInfo)

	match := engine.NewMatch()
	go match.Run()

	app := &application{
		config: cfg,
		logger: logger,
		match:  match,
	}

	err := app.serve()
	if err != nil {
		logger.PrintFatal(err, nil)
	}
}
