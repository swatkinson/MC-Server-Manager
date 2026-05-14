# MC Server Manager - Unified Deployment Setup

This guide explains how to set up the MC Server Manager as a unified service on your Ubuntu server.

## Architecture

The application now runs as a **single Node.js service** that serves:
- REST API endpoints (`/api/*`)
- WebSocket connections (`/socket.io`)
- React frontend (static files)

All from one Express server on **port 80**.

## One-Time Server Setup

### 1. Create application directory and user

```bash
sudo mkdir -p /opt/mc-server-manager
sudo useradd -r -s /bin/false mc-manager 2>/dev/null || true
sudo chown -R mc-manager:mc-manager /opt/mc-server-manager
```

Alternatively, use `www-data` user if it exists on your system:
```bash
sudo chown -R www-data:www-data /opt/mc-server-manager
```

### 2. Install systemd service

Copy the service file to systemd:
```bash
sudo cp mc-server-manager.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 3. Configure environment

Edit `/etc/systemd/system/mc-server-manager.service` and update:

```ini
Environment="MINECRAFT_DIR=/path/to/your/minecraft/server"
```

Where `/path/to/your/minecraft/server` is the actual path to your Minecraft server directory.

Common paths:
- `/home/minecraft/server`
- `/home/ubuntu/MinecraftServer`
- `/opt/minecraft`

### 4. Enable and start the service

```bash
sudo systemctl enable mc-server-manager
sudo systemctl start mc-server-manager
```

### 5. Verify it's running

```bash
# Check status
sudo systemctl status mc-server-manager

# View recent logs
sudo journalctl -u mc-server-manager -n 50 -f

# Test the API
curl http://localhost/api/health
```

### 6. Configure GitHub Actions (if using auto-deployment)

The GitHub Actions workflow needs permission to restart the service without a password prompt.

Add to `/etc/sudoers` (use `sudo visudo`):
```
# Allow github-actions user to restart mc-server-manager without password
github-actions ALL=(ALL) NOPASSWD: /bin/systemctl restart mc-server-manager
github-actions ALL=(ALL) NOPASSWD: /bin/systemctl is-active mc-server-manager
```

Replace `github-actions` with the actual SSH user if different.

## Access the Dashboard

Once running, access the dashboard at:
```
http://<your-server-ip>
```

No port number needed — it's served on port 80.

## Development

For local development, the experience remains unchanged:

```bash
npm install
npm run dev
```

This starts:
- Frontend dev server on `http://localhost:5173`
- Backend API server on `http://localhost:3001`
- Vite dev proxy routes `/api` and `/socket.io` to the backend

## Troubleshooting

### Service fails to start

```bash
# View detailed error
sudo journalctl -u mc-server-manager -n 20

# Manually test the server
sudo -u www-data node /opt/mc-server-manager/dist/backend/server.js
```

### Port 80 permission denied

If you see "EACCES: permission denied", ensure the service user (www-data or mc-manager) exists:

```bash
# Check user exists
id www-data

# Verify service has proper ownership
ls -la /opt/mc-server-manager
sudo chown -R www-data:www-data /opt/mc-server-manager
```

### API calls failing

Ensure:
1. Backend is running: `sudo systemctl status mc-server-manager`
2. `MINECRAFT_DIR` environment variable is set correctly in the service file
3. Minecraft server directory has proper permissions

```bash
# Check environment
sudo systemctl show-environment mc-server-manager | grep MINECRAFT
```

### Updating the application

When you push to `main` on GitHub:
1. GitHub Actions automatically builds and deploys
2. Service is restarted automatically
3. Dashboard updates automatically in the browser

Manual deployment:
```bash
cd /opt/mc-server-manager
git pull
npm ci
npm run build:prod
sudo systemctl restart mc-server-manager
```

## Logs

View application logs:
```bash
# Real-time logs
sudo journalctl -u mc-server-manager -f

# Last 100 lines
sudo journalctl -u mc-server-manager -n 100

# Specific time range
sudo journalctl -u mc-server-manager --since "2 hours ago"
```

## Service Management

```bash
# Start
sudo systemctl start mc-server-manager

# Stop
sudo systemctl stop mc-server-manager

# Restart
sudo systemctl restart mc-server-manager

# Check status
sudo systemctl status mc-server-manager

# Disable auto-start on boot
sudo systemctl disable mc-server-manager

# Enable auto-start on boot
sudo systemctl enable mc-server-manager
```

## Removing nginx

If you previously used nginx to serve the dashboard, you can remove it:

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo apt remove nginx

# Or keep it if used for other purposes
```

The MC Server Manager no longer needs nginx.

## Configuration

Environment variables can be set in the systemd service file:

```ini
[Service]
Environment="NODE_ENV=production"
Environment="PORT=80"
Environment="MINECRAFT_DIR=/path/to/server"
```

Restart the service after making changes:
```bash
sudo systemctl daemon-reload
sudo systemctl restart mc-server-manager
```
