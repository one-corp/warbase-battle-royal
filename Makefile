.PHONY: build run

build:
	@echo "Building Frontend Client..."
	@cd client && npm run build

run: build
	@echo "Starting Unified Game Server (Port 8080)..."
	@cd server && go run ./cmd/game/
