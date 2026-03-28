.PHONY: run build test lint migrate-up migrate-down

run:
	go run ./cmd/server

build:
	go build -o server ./cmd/server

test:
	go test ./... -v -race

lint:
	golangci-lint run ./...

migrate-up:
	migrate -path internal/database/migrations -database "$$DATABASE_URL" up

migrate-down:
	migrate -path internal/database/migrations -database "$$DATABASE_URL" down 1

migrate-create:
	@read -p "Migration name: " name; \
	migrate create -ext sql -dir internal/database/migrations -seq $$name

tidy:
	go mod tidy

dev:
	air -c .air.toml
