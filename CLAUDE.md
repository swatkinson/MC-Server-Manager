# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start backend (port 3001) + Vite dev server concurrently
npm run dev:backend   # Backend only (tsx, no compile)
npm run dev:frontend  # Vite dev server only
npm run build         # Vite build → dist/
npm run build:prod    # Vite build + tsc backend → dist/ + dist/backend/
npm run start         # Run compiled backend: node dist/backend/server.js
npm run typecheck     # Type-check frontend and backend without emitting files
```

There are no tests and no linter configured in this project.

The Vite dev server proxies `/api` and `/socket.io` to `:3001`, so running `npm run dev` is all that's needed for local development.

## Architecture

MC Server Manager is a single Node.js process (Express + Socket.IO) running on the same Ubuntu VM as the Minecraft server. In production it serves the compiled Vite frontend as static files and handles all API and WebSocket traffic on port 80 (via `CAP_NET_BIND_SERVICE`). In development, Vite and Express run on separate ports with proxy.

The app controls Minecraft by shelling out:
- **Start:** `bash start.sh` in `MINECRAFT_DIR`
- **Commands:** `screen -S minecraft -X stuff '<cmd>\n'`
- **Status:** `pgrep -x java`
- **Stop:** graceful via `stop` command; force-stop via `pkill -f java.*\.jar`
- **Console:** poll `logs/latest.log` every 1 s (inode-aware for log rotation)

All env-driven configuration lives in `backend/config.ts` (`MINECRAFT_DIR`, `MC_SCREEN_SESSION`, `PORT`, etc.).

### Backend Services (`backend/services/`)

| Service | Responsibility |
|---|---|
| `ServerManager` | start/stop/restart, status, uptime, version |
| `ConsoleManager` | log polling, command execution, player join/leave detection |
| `MetricsCollector` | CPU (`/proc/stat`), RAM (`/proc/meminfo`), JVM heap (`jstat`), storage (`df`), TPS |
| `TpsTracker` | Polls `forge tps` + `spark tps` (Forge), `tps`/`mspt` (Paper) every 10 s; parses Spark's two-line output; suppresses probe output from console |
| `PlayerManager` | In-memory online player map; reads `ops.json` (60 s TTL cache) |
| `ConfigManager` | Read/write `server.properties` and `whitelist.json` |
| `PreflightChecker` | Validates paths and required binaries on startup (`java`, `screen`, `pgrep`, `pkill`, `jstat`) |
| `PortForwardChecker` | Checks external reachability 30 s after server start via `api.ipify.org` + `mcsrvstat.us` |
| `AuditLogger` | Appends structured JSON entries to an audit log file; supports paginated retrieval |
| `DiscordNotifier` | Sends Discord webhook embeds for server start/stop/crash, scheduled restarts, and backup events; config persisted to JSON |
| `BackupService` | Creates/lists/deletes/restores `tar.gz` world backups; enforces a keep-count retention policy; supports optional scheduled daily backups |
| `RestartScheduler` | Schedules automatic daily server restarts at a configured hour/minute; sends in-game 5-min and 1-min warnings; persists schedule to JSON |
| `UserStore` | Persists user accounts (id, username, passwordHash, role) to `users.json`; CRUD operations for admin/moderator/user accounts |
| `AuthService` | JWT-based authentication (bcrypt password hashing, 8-hour tokens); issues and validates `mc_auth` session cookies |
| `ServerInfoStore` | Persists server metadata (version, serverType) to `server-info.json` |
| `StartupScriptManager` | Reads and writes JVM flags (`-Xms`, `-Xmx`, extra flags). Auto-detects mode: `argfile` manages Forge/NeoForge `user_jvm_args.txt` (one flag per line, no jar, comment header preserved) when it exists; otherwise `script` parses/reconstructs the classic `java … -jar` line in `start.sh` |

`backend/server.ts` instantiates all services, wires routes and Socket.IO events, and starts the HTTP server.

### Frontend

Two pages: `src/pages/Dashboard.tsx` (main view) and `src/pages/AccountsPage.tsx` (admin only). TanStack Router is set up in `src/main.tsx`. `ToastContext` and `AuthContext` are the React contexts.

**Role-based access:** Three roles — `admin` (full access), `moderator` (no Manage Accounts), `user` (read-only: metrics, player count, console). `requireRole()` middleware in `backend/middleware/requireAuth.ts` gates routes. Frontend conditionally renders `ControlButtons`, `ConfigPanel`, and `ConsoleInput` based on `user.role` from `useAuth()`.

**Shared Socket.IO singleton:** `useServerSocket` maintains a module-level socket with a ref count. All data hooks (`useMetrics`, `useServerStatus`, `useConsoleLogs`, `usePlayerList`, `useWhitelist`, `useServerConfig`, `usePortForwardCheck`) share this one connection; it disconnects when the last consumer unmounts.

**Dual-channel data pattern:** Every data type follows the same structure:
1. Initial load via `useApi` (REST GET, with optional polling interval)
2. Live updates via `useServerSocket().on(event, ...)` (WebSocket push)
3. Fallback HTTP polling when WebSocket is disconnected (implemented in `useConsoleLogs`)

API utilities are in `src/hooks/useApi.ts`: `useApi` for GET with auto-polling, `apiPost` and `apiDelete` for mutations.

**Type sync:** `src/types/api.ts` and `backend/types/index.ts` are identical interfaces kept in sync manually — there is no shared package.

### Socket.IO Events (server → client)

`metrics:updated`, `console:line`, `server:status:changed`, `players:updated`, `config:updated`, `whitelist:updated`, `portforward:result`, `scheduler:updated`

## Coding Standards

- TypeScript strict mode — no `any`, no `@ts-ignore` without justification
- Functional components only; prefer named exports
- No inline styles except for dynamic/computed values
- No CSS frameworks or UI component libraries without explicit approval
- Extract components when they exceed ~100 lines

CSS uses flat custom properties (`--bg`, `--bg-card`, `--border`, `--text`, `--text-muted`, `--green`, `--red`, `--yellow`) defined in `src/styles/app.css` with BEM-like class naming.

## Development Conventions

**Branch naming:** `#<issue-number>-<issue-title>` (e.g. `#4-server-status-header`). Do not push directly to `main`.

**Commit messages:** Conventional format — `feat:`, `fix:`, `chore:`, etc. No vague messages.

**README updates:** After every meaningful change, update `README.md` — check off implemented features, add new ones, update the Tech Stack table if dependencies changed.

**CLAUDE.md updates:** Keep this file current — if the architecture, commands, services, patterns, or conventions change, update the relevant section here so future sessions start with accurate context.

**Adding a new page/route:** Create the component in `src/pages/`, register the route in `src/main.tsx`, update README.

**CI/CD:** `.github/workflows/deploy.yml` runs on every push to `main` — rsyncs the build to the server and restarts the `mc-server-manager` systemd unit. If the build output or command changes, update the workflow too.
