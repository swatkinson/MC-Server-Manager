# MC Server Manager

A self-hosted web dashboard for managing a Minecraft server, built with React + TanStack Router and designed to run directly on the Ubuntu Server VM alongside the Minecraft server.

---

## Project Goals

- Provide a clean, modern web UI to monitor and control a Minecraft server
- Self-hosted: runs on the same Ubuntu Server VM as the MC server — no external hosting
- Automated CI/CD: every push to `main` auto-deploys to the server via GitHub Actions
- Progressively add features without breaking existing functionality

---

## Planned Features

### Phase 1 — MVP & CI/CD Pipeline *(current)*
- [x] Basic dashboard UI (TanStack Router + React + Vite)
- [x] Automated deployment via GitHub Actions → rsync → nginx

### Phase 2 — Dashboard & Server Control
- [ ] Server status header with name, IP, MOTD, and status (#4)
- [ ] Server control buttons: start / stop / restart (#4)
- [ ] Live console display with command input (#5)
- [ ] System monitoring gauges: CPU, RAM, Storage (#7)
- [ ] Real start / stop / restart (via systemctl or screen/tmux)
- [ ] Live server status (online/offline, uptime)

### Phase 3 — Player Management & Configuration
- [ ] Online player list (#6)
- [ ] Kick / ban / op / whitelist controls
- [ ] Player history log
- [ ] Server configuration editor (server.properties) (#8)
- [ ] JVM parameters editor (#8)
- [ ] Whitelist manager (#8)
- [ ] World file download/backup (#8)

### Phase 4 — Console & Logs
- [ ] Live log streaming (WebSocket)
- [ ] Log history and search
- [ ] In-browser console (send commands to server)

### Phase 5 — Configuration & Backups
- [ ] Edit `server.properties` via UI
- [ ] Plugin/mod listing
- [ ] Automated backup scheduling and management

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + TypeScript |
| Routing | TanStack Router v1 |
| Build Tool | Vite |
| Styles | Plain CSS (no framework) |
| CI/CD | GitHub Actions |
| Web Server | nginx (serves built static files) |
| Host | Ubuntu Server VM |

---

## Development

### Prerequisites
- Node.js 20+
- npm

### Run locally
```bash
git clone https://github.com/swatkinson/mc-server-manager.git
cd mc-server-manager
npm install
npm run dev
```

### Build
```bash
npm run build       # outputs to dist/
npm run preview     # preview the built output locally
```

---

## CI/CD Pipeline

Every push to `main` triggers the GitHub Actions deploy workflow which:
1. Checks out the code on a GitHub-hosted runner
2. Installs dependencies and builds the project (`dist/`)
3. Connects to the Ubuntu server via SSH
4. Rsyncs the built `dist/` to `/var/www/mc-server-manager/` on the server
5. nginx automatically serves the updated files

### Required GitHub Secrets

Add these in **Settings → Secrets and variables → Actions** on the repository:

| Secret | Description |
|---|---|
| `SERVER_HOST` | IP address or hostname of the Ubuntu server |
| `SERVER_USER` | SSH username (e.g. `ubuntu` or your username) |
| `SSH_PRIVATE_KEY` | Private SSH key content (ED25519 recommended) |
| `SERVER_PORT` | SSH port — optional, defaults to `22` |

---

## Server Setup (Ubuntu)

Follow these steps once to prepare the Ubuntu server to receive deployments.

### 1. Install nginx
```bash
sudo apt update && sudo apt install -y nginx
```

### 2. Create the web root directory
```bash
sudo mkdir -p /var/www/mc-server-manager
sudo chown -R $USER:$USER /var/www/mc-server-manager
```

### 3. Configure nginx

Create a new site config:
```bash
sudo nano /etc/nginx/sites-available/mc-server-manager
```

Paste the following (replace `_` with your server's IP or domain if desired):
```nginx
server {
    listen 80;
    server_name _;

    root /var/www/mc-server-manager;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable the site and reload nginx:
```bash
sudo ln -s /etc/nginx/sites-available/mc-server-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

> You may want to remove the default nginx site: `sudo rm /etc/nginx/sites-enabled/default`

### 4. Create an SSH key pair for GitHub Actions

Run this on your Ubuntu server:
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy
```

This creates:
- `~/.ssh/github_deploy` — **private key** (goes into GitHub Secrets)
- `~/.ssh/github_deploy.pub` — **public key** (stays on the server)

### 5. Authorize the key on the server

```bash
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 6. Add secrets to GitHub

Go to your repository → **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `SERVER_HOST` | Your server's IP address |
| `SERVER_USER` | Your SSH username |
| `SSH_PRIVATE_KEY` | Full contents of `~/.ssh/github_deploy` (the private key file) |
| `SERVER_PORT` | `22` (or your custom port) |

### 7. Test the pipeline

Push any change to `main` and watch the **Actions** tab on GitHub. The deploy job should complete and your dashboard will be live at `http://<your-server-ip>/`.
