# SMSystem — Agent Quick Reference

## Repo Boundaries

| Directory | Purpose |
|-----------|---------|
| `frontend/` | React + Vite + TypeScript SPA (real frontend workspace) |
| `frontend/src-tauri/` | Tauri 2.x Rust desktop shell |
| `backend/` | Go + Gin API server |
| `root/` | Minimal — only holds `package.json` for Playwright tests |

**Do not treat root as a workspace.** The root `package.json` exists only for `@playwright/test`. All frontend work lives in `frontend/`.

## Entry Points

- **Backend**: `backend/cmd/server/main.go`
- **Frontend**: `frontend/src/main.tsx` (mounts `frontend/src/App.tsx`)
- **Migrations**: `backend/db/migrate.go` (embedded SQL via `//go:embed migrations/*.sql`)
- **Tauri config**: `frontend/src-tauri/tauri.conf.json`

## Developer Commands

### Frontend
```bash
cd frontend
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build → dist/
npm run lint         # ESLint
npm run test         # Vitest (unit tests)
npm run tauri dev    # Run in Tauri dev mode
npm run tauri:build # Build desktop app
```

### Backend
```bash
cd backend
make run             # go run cmd/server/main.go
make build           # Build binary → smsystem-server
make migrate         # Run all pending migrations
make migrate-up      # Run pending migrations
make migrate-status  # Show migration status
make migrate-reset   # DROP ALL tables + re-run migrations (requires "yes")
make test            # go test ./...
make lint            # golangci-lint run
```

### Full Stack (Docker)
```bash
docker-compose up -d   # MySQL + backend
```

## Config Quirks

- **Backend env**: Reads from `backend/.env` (loads paths: `.env`, `../.env`, `$EXE_DIR/.env`). Required: `JWT_SECRET` (≥32 chars).
- **Backend port**: Reads `SERVER_PORT` (default `8080`). Note: root `.env.production.example` incorrectly shows `PORT` — ignore it.
- **Frontend API**: `VITE_API_BASE_URL` (defaults to `http://168.144.46.137:8080` in many files — this is the production VPS, not localhost).
- **Vite proxy**: Only active in dev mode; production builds hit the backend directly.

## Auth & Roles

- **JWT**: Bearer token in `Authorization` header.
- **Roles**: `admin`, `super_admin`, `cashier`, `purchasing`, `purchaser`, `user`.
- **SSE endpoint**: `/api/events` — auth passed via query param `?token=<JWT>` (EventSource can't send headers).
- **Offline mode**: Use password `offline_mode` during login to trigger offline flow. Caches products/categories/customers to localStorage. Token stored as `offline_token`.

## Key API Routes

- `GET /api/health` — health check
- `GET /api/listroutes` — debug: list all registered routes
- `GET /api/events` — Server-Sent Events stream
- Protected routes: `/api/dashboard`, `/api/orders`, `/api/products`, `/api/inventory`, etc.
- Admin-only: `/api/products` (POST/PUT/DELETE), `/api/expenses`, `/api/inventory/in|out|adjust`
- Super admin only: `/api/branches` (POST/PUT)

## Patterns Agents Often Miss

- **Migrations are auto-run on backend startup** — no separate step needed during dev unless you need to inspect.
- **Frontend has TWO QueryClientProviders**: one in `main.tsx` (global), one in `App.tsx`. Both are used.
- **Offline cache is real**: `frontend/src/services/offlineStorage.ts` — agents should not assume all data comes from API.
- **Event service auto-reconnects**: `frontend/src/services/eventService.ts` with exponential backoff. Invalidation happens automatically on SSE events.

## Ignore These Paths (Noise)

```
.worktrees/
node_modules/
frontend/src-tauri/target/
frontend/node_modules/
frontend/dist/
backend/tmp/
backend/smsystem*
backend/*.db
.tmp/
.git/
```

## Testing

- **Frontend unit**: `frontend/src/**/*.test.ts` — Vitest + jsdom + vi mocks
- **Backend unit**: `backend/**/*_test.go` — standard `go test`
- **E2E (root)**: Playwright — `npx playwright test` (requires running backend + frontend)

## Version & Build Info

- Frontend: `frontend/package.json` → version `4.1.1`
- Tauri: `frontend/src-tauri/Cargo.toml` → version `2.10.0`
- Backend: `backend/go.mod` → Go `1.21`
- Build outputs (not in repo): `frontend/dist/`, `backend/smsystem-server`, `frontend/src-tauri/target/release/`
