.PHONY: run build migrate migrate-up migrate-down migrate-reset migrate-status clean

# Run the server
run:
	go run cmd/server/main.go

# Build the binary
build:
	go build -o smsystem-server cmd/server/main.go

# Run all pending migrations
migrate:
	@echo "Running migrations..."
	@go run cmd/migrate/main.go up

# Run migrations up
migrate-up:
	@go run cmd/migrate/main.go up

# Run migrations down (rollback last)
migrate-down:
	@go run cmd/migrate/main.go down

# Reset database (drop all tables and re-migrate)
migrate-reset:
	@echo "Resetting database..."
	@go run cmd/migrate/main.go reset

# Show migration status
migrate-status:
	@go run cmd/migrate/main.go status

# Clean build artifacts
clean:
	rm -f smsystem-server
	rm -rf tmp/

# Install dependencies
deps:
	go mod download
	go mod tidy

# Run tests
test:
	go test ./...

# Lint code
lint:
	@which golangci-lint > /dev/null || echo "Run: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"
	golangci-lint run

# Generate binary for migration tool
migrate-bin:
	go build -o bin/migrate cmd/migrate/main.go
