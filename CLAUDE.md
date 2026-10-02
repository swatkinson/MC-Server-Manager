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
- **Status:** `pgrep -x java` (+ a 10 s watchdog in `server.ts` that reports crashes to Discord)
- **Stop:** graceful via `stop` command; force-stop via `pkill -f java.*\.jar`
- **Console:** poll `logs/latest.log` every 1 s (inode-aware for log rotation)

All env-driven configuration lives in `backend/config.ts` (`MINECRAFT_DIR`, `MC_SCREEN_SESSION`, `PORT`, etc.).

### Backend Services (`backend/services/`)

| Service | Responsibility |
|---|---|
| `ServerManager` | start/stop/restart, status, uptime, version |
| `ConsoleManager` | log polling, in-memory console history (seeded from latest.log minus probe noise), command execution, player join/leave/`list` detection |
| `MetricsCollector` | CPU (`/proc/stat`), RAM (`/proc/meminfo`), storage (`df`), TPS; JVM memory from `JvmInspector` |
| `JvmInspector` | Samples the Minecraft JVM's hsperfdata file every 5 s (`hsperfdata.ts` parser): live heap (old+survivor), heap in use, committed, max (`-Xmx` from vmArgs), RSS, GC pause %, full GCs, pressure verdict; keeps 1 h history |
| `TpsTracker` | Polls `forge tps` (Forge), `tps`/`mspt` (Paper) every 10 s; still parses Spark output; suppresses probe output from console; `isProbeNoise()` cleans history |
| `PlayerManager` | In-memory online player map; `ops.json` + `usercache.json` (UUIDs), 60 s TTL caches |
| `ConfigManager` | Read/write `server.properties` and `whitelist.json` |
| `PreflightChecker` | Validates paths and required binaries on startup (`java`, `screen`, `pgrep`, `pkill`) and that the JVM perf counters are readable |
| `PortForwardChecker` | Checks external reachability 30 s after server start via `api.ipify.org` + `mcsrvstat.us` |
| `AuditLogger` | Appends structured JSON entries to an audit log file; supports paginated retrieval |
| `DiscordNotifier` | Sends Discord webhook embeds for server start/stop/crash, scheduled restarts, and backup events; config persisted to JSON |
| `BackupService` | Client for the Proxmox host's `mc-backup-gateway` over SSH (list / run / fetch); restores by swapping the world dir (server must be stopped) |
| `ModConfigService` | Lists/reads/writes text configs under `config/`, `world/serverconfig/`, `defaultconfigs/`; realpath containment, mtime conflict check, last 10 versions per file in `mc-server-manager/config-history/` |
| `RestartScheduler` | Schedules automatic daily server restarts at a configured hour/minute; sends in-game 5-min and 1-min warnings; persists schedule to JSON |
| `UserStore` | Persists user accounts (id, username, passwordHash, role) to `users.json`; CRUD operations for admin/moderator/user accounts |
| `AuthService` | JWT-based authentication (bcrypt password hashing, 8-hour tokens); issues and validates `mc_auth` session cookies |
| `ServerInfoStore` | Persists server metadata (version, serverType) to `server-info.json` |
| `StartupScriptManager` | Reads and writes `start.sh`, parsing and reconstructing JVM flags (`-Xms`, `-Xmx`, `-jar`, extra flags) |

`backend/server.ts` instantiates all services, wires routes and Socket.IO events, and starts the HTTP server.

### Frontend

Signed-in pages render inside `AppShell` (pathless layout route in `src/main.tsx`: sidebar + top bar with server controls): `Dashboard` (overview), `ModConfigsPage`, `BackupsPage`, `SettingsPage` (tiles opening the existing editor modals), `AccountsPage` and `AuditLogPage` (admin). Contexts: `ToastContext`, `AuthContext`, `ServerDataContext` (single status poll + metrics subscription shared by the shell and pages).

**Role-based access:** Three roles — `admin` (full access), `moderator` (no Manage Accounts), `user` (read-only: metrics, player count, console). `requireRole()` middleware in `backend/middleware/requireAuth.ts` gates routes. Frontend conditionally renders `ControlButtons`, `ConfigPanel`, and `ConsoleInput` based on `user.role` from `useAuth()`.

**Shared Socket.IO singleton:** `useServerSocket` maintains a module-level socket with a ref count. All data hooks (`useMetrics`, `useServerStatus`, `useConsoleLogs`, `usePlayerList`, `useWhitelist`, `useServerConfig`, `usePortForwardCheck`) share this one connection; it disconnects when the last consumer unmounts.

**Dual-channel data pattern:** Every data type follows the same structure:
1. Initial load via `useApi` (REST GET, with optional polling interval)
2. Live updates via `useServerSocket().on(event, ...)` (WebSocket push)
3. Fallback HTTP polling when WebSocket is disconnected (implemented in `useConsoleLogs`)

API utilities are in `src/hooks/useApi.ts`: `useApi` for GET with auto-polling, `apiPost` and `apiDelete` for mutations.

**Type sync:** `src/types/api.ts` and `backend/types/index.ts` are identical interfaces kept in sync manually — there is no shared package.

### Socket.IO Events (server → client)

`metrics:updated`, `console:line`, `server:status:changed`, `players:updated`, `config:updated`, `whitelist:updated`, `portforward:result`, `scheduler:updated`, `backups:updated`

## Coding Standards

- TypeScript strict mode — no `any`, no `@ts-ignore` without justification
- Functional components only; prefer named exports
- No inline styles except for dynamic/computed values
- No CSS frameworks or UI component libraries without explicit approval
- Extract components when they exceed ~100 lines

CSS uses flat custom properties defined in `src/styles/app.css` (`--bg`, `--bg-card` (glass), `--bg-elevated`, `--bg-sunken`, `--border`, `--text`, `--text-muted`, `--accent` (lantern orange), `--teal`, `--green`, `--red`, `--yellow`, `--chart-heap`/`--chart-live`) with BEM-like class naming. Surfaces are glass (`.card` / `.glass`) over `.app-bg`, a blurred `public/background.png`. Modal styles live in `src/styles/config-panel.css`.

## Development Conventions

**Branch naming:** `#<issue-number>-<issue-title>` (e.g. `#4-server-status-header`). Do not push directly to `main`.

**Commit messages:** Conventional format — `feat:`, `fix:`, `chore:`, etc. No vague messages.

**README updates:** After every meaningful change, update `README.md` — check off implemented features, add new ones, update the Tech Stack table if dependencies changed.

**CLAUDE.md updates:** Keep this file current — if the architecture, commands, services, patterns, or conventions change, update the relevant section here so future sessions start with accurate context.

**Adding a new page/route:** Create the component in `src/pages/`, register the route in `src/main.tsx`, update README.

**CI/CD:** `.github/workflows/deploy.yml` runs on every push to `main` — copies the build to the server (no rsync on the VM) and restarts the `mc-server-manager` systemd unit (`KillMode=process`, so Minecraft survives). If the build output or command changes, update the workflow too.
