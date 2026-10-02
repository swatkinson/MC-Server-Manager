# MC Server Manager

A self-hosted web dashboard for managing a Minecraft server, built with React +
TanStack Router on the frontend and an Express + Socket.IO backend. Both are
served from a single Node.js process running directly on the same Ubuntu Server
VM as the Minecraft server.

---

## Quick Start — Setup on a New Server

Drop this dashboard beside any vanilla or modded Minecraft Java server on Ubuntu.

1. **Clone the repo** onto your server:
   ```bash
   git clone https://github.com/swatkinson/mc-server-manager.git
   cd mc-server-manager
   ```

2. **Install dependencies and build:**
   ```bash
   npm install && npm run build:prod
   ```

3. **Configure the app** — copy the example env file and set the required values:
   ```bash
   cp .env.example .env
   # Edit .env: set JWT_SECRET and MINECRAFT_DIR at minimum
   ```
   Generate a secret: `openssl rand -base64 48`

4. **Create `$MINECRAFT_DIR/start.sh`** that launches your server inside a `screen` session.
   See `DEPLOYMENT_SETUP.md` for a ready-to-use template.

5. **Install and enable the systemd service:**
   ```bash
   sudo cp mc-server-manager.service /etc/systemd/system/
   # Edit the unit file: replace <your-username> with your system user
   sudo systemctl daemon-reload
   sudo systemctl enable --now mc-server-manager
   ```

6. **Open `http://your-server-ip`** in a browser — the first run creates an admin account.

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
- [x] Automated deployment via GitHub Actions → copy → systemd

### Phase 2 — Dashboard & Server Control
- [x] Glass UI over a blurred background photo, sidebar navigation (Overview, Mod Configs, Backups, Server Settings, Accounts, Audit Log)
- [x] Top bar with MOTD, status, version, uptime and TPS
- [x] Server control buttons: start / stop / restart
- [x] Live console display with command input
- [x] Overview tiles: players, TPS/MSPT, Minecraft memory, CPU, storage
- [x] JVM memory insight: live heap after GC, heap in use, Java RSS, GC pause share, full GCs, pressure verdict and a 1 h history graph (read from hsperfdata — no jstat, no attach)
- [x] System card: VM memory split (Java / other / free), per-core CPU, disk
- [x] Real start / stop / restart (via `screen` + `start.sh`)
- [x] Live server status (online/offline, uptime)
- [x] TPS / MSPT monitoring (Paper, Forge, Spark)

### Phase 3 — Player Management & Configuration
- [x] Online player list (parsed from server log, real UUIDs from usercache.json, re-synced with `list` after a panel restart)
- [x] Server configuration editor (`server.properties`)
- [x] JVM parameters editor (`user_jvm_args.txt` for Forge)
- [x] Mod config editor: browse/search/edit `config/`, `world/serverconfig/`, `defaultconfigs/` with stale-write protection and per-file version history
- [x] Whitelist manager (add / remove / enforce toggle)
- [x] World file download/backup (streamed tar.gz)
- [ ] Kick / ban / op controls
- [ ] Player history log

### Phase 4 — Console & Logs
- [x] Live log streaming (WebSocket via Socket.IO)
- [x] In-browser console (send commands to server)
- [x] Console history excludes the panel's own TPS probe output
- [ ] Log history and search

### Phase 5 — Backups & Scheduling
- [x] One-shot world backup download
- [ ] Plugin/mod listing
- [x] Backups page backed by the Proxmox host's `mc-world-backup` job: list, back up now, download, restore (server must be stopped; previous world kept)
- [x] Crash detection → Discord notification

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

---

## Configuration

All configuration is driven by environment variables (`.env` file or systemd `EnvironmentFile`).

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | — | **Required.** Generate: `openssl rand -base64 48` |
| `MINECRAFT_DIR` | `~/MinecraftServer` | Path to your Minecraft server directory |
| `STORAGE_PATH` | `MINECRAFT_DIR` | Where app config/users are stored |
| `WORLD_PATH` | auto-detect from `level-name` | Override world directory path |
| `LOG_PATH` | `MINECRAFT_DIR/logs/latest.log` | Override log file path |
| `START_SCRIPT` | `MINECRAFT_DIR/start.sh` | Override start script path |
| `SERVER_PROPERTIES_PATH` | `MINECRAFT_DIR/server.properties` | Override server.properties path |
| `MC_SCREEN_SESSION` | `minecraft` | Name of the screen session |
| `PORT` | `3001` (dev) / `80` (prod) | HTTP port |
| `BACKUP_HOST` | — | `user@host` running `mc-backup-gateway` (also settable on the Backups page) |
| `BACKUP_SSH_KEY` | `~/.ssh/mc-backup-gateway` | Private key whose `authorized_keys` entry forces the gateway |

`NODE_ENV=production` enables static file serving from `dist/` (set automatically by the systemd unit).

### Optional Tools

Features degrade gracefully if these are absent:

- JVM perf counters (`hsperfdata`) — heap/GC insight. Don't launch with `-XX:+PerfDisableSharedMem`; without them the memory card falls back to process RSS
- `spark` — its `tps` output is parsed if you run it, but the panel only probes with `forge tps` (Forge) or `tps`/`mspt` (Paper)
- `ssh` + a backup host running `mc-backup-gateway` — the Backups page

### Server Type Compatibility

| Feature | Vanilla | Paper | Forge | Fabric |
|---|---|---|---|---|
| Console, start/stop, metrics | ✓ | ✓ | ✓ | ✓ |
| TPS (`tps` command) | — | ✓ | ✓ | ✓ |
| TPS (Spark plugin) | — | ✓ | ✓ | ✓ |
| JVM heap/GC metrics (hsperfdata) | ✓ | ✓ | ✓ | ✓ |

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
2. Copies `dist/` (temp dir + swap), `package.json`, `package-lock.json`, and the systemd unit
   to `~/mc-server-manager` on the host
3. Runs `npm ci --omit=dev` on the host
4. Restarts the `mc-server-manager` systemd service — only the panel; the unit's
   `KillMode=process` leaves a panel-launched Minecraft server running
5. Verifies the service is active

The service unit at `mc-server-manager.service` binds the Node process to
port 80 directly via `CAP_NET_BIND_SERVICE`; nginx is no longer used.

See `DEPLOYMENT_SETUP.md` for one-time host setup.

---

## Backups

Backups are made on the Proxmox host, not by the panel: `/usr/local/sbin/mc-world-backup`
(timer `mc-world-backup.timer`) does `save-off` → `save-all flush` → tar of `world/` over SSH →
`save-on`, keeps the newest `KEEP`, and writes a `.last-run.json` status per server.

The panel reaches it through `/usr/local/sbin/mc-backup-gateway`, installed as a forced
command in the host's `/root/.ssh/authorized_keys`:

```
command="/usr/local/sbin/mc-backup-gateway mc1",from="192.168.0.100",restrict ssh-ed25519 AAAA… mc-server-manager@mc1
```

That key can only `list`, `run` (one-off backup via a transient systemd unit) and
`fetch <archive>` for that one server. Restores happen on the VM: the archive is streamed
down, validated, and swapped in for the world folder (old world kept as
`world.pre-restore-<timestamp>`, newest two retained). The server must be stopped.
