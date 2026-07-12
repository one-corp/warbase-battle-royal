.PHONY: dev client server

dev:
	@echo "Starting Development Environment..."
	@make -j2 client server

client:
	@echo "Starting Client..."
	@cd client && npm run dev

server:
	@echo "Starting Server..."
	@cd server && go run ./cmd/game/
