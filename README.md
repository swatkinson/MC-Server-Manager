# MC Server Manager

A self-hosted web dashboard for managing a Minecraft server, built with React +
TanStack Router on the frontend and an Express + Socket.IO backend. Both are
served from a single Node.js process running directly on the same Ubuntu Server
VM as the Minecraft server.

---

## Project Goals

- Provide a clean, modern web UI to monitor and control a Minecraft server
- Self-hosted: runs on the same Ubuntu Server VM as the MC server — no external hosting
- Automated CI/CD: every push to `main` auto-deploys to the server via GitHub Actions
- Progressively add features without breaking existing functionality

---

## Features

### Phase 1 — MVP & CI/CD Pipeline
- [x] Basic dashboard UI (TanStack Router + React + Vite)
- [x] Automated deployment via GitHub Actions → rsync → systemd

### Phase 2 — Dashboard & Server Control
- [x] Server status header with name, IP, MOTD, and status
- [x] Server control buttons: start / stop / restart
- [x] Live console display with command input
- [x] System monitoring gauges: CPU, RAM, Storage (arc gauges)
- [x] Real start / stop / restart (via `screen` + `start.sh`)
- [x] Live server status (online/offline, uptime)
- [x] TPS / MSPT monitoring (Paper, Forge, Spark)

### Phase 3 — Player Management & Configuration
- [x] Online player list (parsed from server log)
- [x] Server configuration editor (`server.properties`)
- [x] JVM parameters reference panel
- [x] Whitelist manager (add / remove / enforce toggle)
- [x] World file download/backup (streamed tar.gz)
- [ ] Kick / ban / op controls
- [ ] Player history log

### Phase 4 — Console & Logs
- [x] Live log streaming (WebSocket via Socket.IO)
- [x] In-browser console (send commands to server)
- [ ] Log history and search

### Phase 5 — Backups & Scheduling
- [x] One-shot world backup download
- [ ] Plugin/mod listing
- [ ] Automated backup scheduling and management

### Phase 6 — Authentication & Access Control
- [x] Account-based authentication (JWT cookies)
- [x] Role-based access control: `admin` / `moderator` / `user`
  - **admin** — full access including account management
  - **moderator** — full dashboard access; no Manage Accounts page
  - **user** — read-only: metrics, player list, console view (no input, no server control)

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Routing | TanStack Router v1 |
| Build Tool | Vite |
| Styles | Plain CSS (no framework) |
| Backend | Express + Socket.IO (Node 18+) |
| Realtime | Socket.IO with polling fallback |
| CI/CD | GitHub Actions (self-hosted runner) |
| Process | systemd (`mc-server-manager.service`) |
| Host | Ubuntu Server VM |

---

## Architecture

A single Node.js process serves both the React static bundle and the API.

```
browser ──HTTP/WS──▶ Node process (port 80)
                       │
                       ├─ serves dist/ static files
                       ├─ REST /api/* (Express)
                       ├─ /socket.io/* (Socket.IO)
                       │
                       └─ talks to the MC server via:
                           ├─ `screen -S minecraft -X stuff` (commands)
                           ├─ `pgrep` / `pkill` (status / hard stop)
                           ├─ `start.sh` (start)
                           ├─ tails logs/latest.log
                           └─ reads/writes server.properties, whitelist.json
```

Configurable via environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` (dev) / `80` (prod) | HTTP port |
| `NODE_ENV` | `development` | `production` enables static file serving |
| `MINECRAFT_DIR` | `~/MinecraftServer` | Root directory of the MC server |
| `STORAGE_PATH` | `$MINECRAFT_DIR` | Path queried by `df` for the storage gauge |
| `MC_SCREEN_SESSION` | `minecraft` | Name of the `screen` session running the MC server |

---

## Development

### Prerequisites
- Node.js 18+
- npm

### Run locally
```bash
git clone https://github.com/swatkinson/mc-server-manager.git
cd mc-server-manager
npm install
npm run dev          # starts the backend (3001) and Vite dev server in parallel
```

The Vite dev server proxies `/api` and `/socket.io` to `localhost:3001`.

### Scripts
```bash
npm run dev          # backend + frontend dev servers
npm run typecheck    # type-check frontend and backend
npm run build        # build frontend only (dist/)
npm run build:prod   # build frontend AND compile backend (dist/backend/)
npm run start        # run the compiled backend
```

---

## Deployment

The dashboard is deployed via `.github/workflows/deploy.yml` on a self-hosted
GitHub Actions runner that lives on the same Ubuntu host as the Minecraft
server. Every push to `main` (or manual `workflow_dispatch`):

1. Installs deps and runs `npm run build:prod`
2. Rsyncs `dist/`, `package.json`, `package-lock.json`, and the systemd unit
   to `~/mc-server-manager` on the host
3. Runs `npm ci --omit=dev` on the host
4. Restarts the `mc-server-manager` systemd service
5. Verifies the service is active

The service unit at `mc-server-manager.service` binds the Node process to
port 80 directly via `CAP_NET_BIND_SERVICE`; nginx is no longer used.

See `DEPLOYMENT_SETUP.md` for one-time host setup.
