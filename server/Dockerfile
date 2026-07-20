# Build Stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files first for caching
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build the Go server
RUN CGO_ENABLED=0 GOOS=linux go build -o /server_bin ./cmd/game

# Run Stage
FROM alpine:latest

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /server_bin /app/server_bin

# Expose the WebSocket port
EXPOSE 8081

# Run the server
CMD ["/app/server_bin", "--env=production"]
