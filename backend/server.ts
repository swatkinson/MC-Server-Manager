import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { ServerManager } from './services/ServerManager.js';
import { MetricsCollector } from './services/MetricsCollector.js';
import { ConsoleManager } from './services/ConsoleManager.js';
import { ConfigManager } from './services/ConfigManager.js';
import { PlayerManager } from './services/PlayerManager.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const serverManager = new ServerManager();
const metricsCollector = new MetricsCollector();
const consoleManager = new ConsoleManager();
const configManager = new ConfigManager();
const playerManager = new PlayerManager();

app.use(express.json());
app.use(cors());

if (NODE_ENV === 'production') {
  const staticPath = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  app.use(express.static(staticPath, { index: false }));
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.get('/api/server/status', async (_req: Request, res: Response) => {
  try {
    const status = await serverManager.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get server status' });
  }
});

app.post('/api/server/start', async (_req: Request, res: Response) => {
  try {
    const result = await serverManager.start();
    io.emit('server:status:changed', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start server' });
  }
});

app.post('/api/server/stop', async (_req: Request, res: Response) => {
  try {
    const result = await serverManager.stop();
    io.emit('server:status:changed', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop server' });
  }
});

app.post('/api/server/restart', async (_req: Request, res: Response) => {
  try {
    const result = await serverManager.restart();
    io.emit('server:status:changed', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to restart server' });
  }
});

app.get('/api/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsCollector.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

app.get('/api/console/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await consoleManager.getLogs(limit);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get console logs' });
  }
});

app.post('/api/console/command', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    const output = await consoleManager.executeCommand(command);
    io.emit('console:command:executed', { command, output });
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

app.get('/api/config/server-properties', async (_req: Request, res: Response) => {
  try {
    const properties = await configManager.getServerProperties();
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get server properties' });
  }
});

app.post('/api/config/server-properties', async (req: Request, res: Response) => {
  try {
    const result = await configManager.setServerProperties(req.body.properties);
    io.emit('config:updated', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update server properties' });
  }
});

app.get('/api/config/whitelist', async (_req: Request, res: Response) => {
  try {
    const entries = await configManager.getWhitelist();
    const enabled = await configManager.isWhitelistEnabled();
    res.json({ entries, enabled });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get whitelist' });
  }
});

app.post('/api/config/whitelist', async (req: Request, res: Response) => {
  try {
    const { uuid, name, entries, enabled } = req.body;

    // If entries array is provided, update whitelist with all entries
    if (entries) {
      const result = await configManager.setWhitelist(entries);
      if (result.success) {
        const whitelistData = { entries, enabled: enabled ?? true };
        io.emit('whitelist:updated', whitelistData);
      }
      res.json(result);
    } else if (enabled !== undefined) {
      // Toggle whitelist enabled state
      const result = await configManager.setWhitelistEnabled(enabled);
      if (result.success) {
        const entries = await configManager.getWhitelist();
        const whitelistData = { entries, enabled };
        io.emit('whitelist:updated', whitelistData);
      }
      res.json(result);
    } else {
      // Add single player
      const result = await configManager.addToWhitelist(uuid, name);
      if (result.success) {
        const entries = await configManager.getWhitelist();
        io.emit('whitelist:updated', { entries, enabled: await configManager.isWhitelistEnabled() });
      }
      res.json(result);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update whitelist' });
  }
});

app.delete('/api/config/whitelist/:uuid', async (req: Request, res: Response) => {
  try {
    const uuid = Array.isArray(req.params.uuid) ? req.params.uuid[0] : req.params.uuid;
    const result = await configManager.removeFromWhitelist(uuid);
    if (result.success) {
      const entries = await configManager.getWhitelist();
      io.emit('whitelist:updated', { entries, enabled: await configManager.isWhitelistEnabled() });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from whitelist' });
  }
});

app.post('/api/server/world-backup', async (_req: Request, res: Response) => {
  try {
    const minecraftDir = process.env.MINECRAFT_DIR || `${process.env.HOME}/MinecraftServer`;
    const worldPath = path.join(minecraftDir, 'world');

    // Set response headers
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="world-backup-${new Date().toISOString().split('T')[0]}.tar.gz"`);

    // Create archive stream
    const archive = archiver('tar', { gzip: true });

    // Handle archive errors
    archive.on('error', (err: any) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create backup archive' });
      }
    });

    // Pipe archive to response
    archive.pipe(res);

    // Append world directory to archive
    if (fs.existsSync(worldPath)) {
      archive.directory(worldPath, 'world');
    } else {
      return res.status(400).json({ error: 'World directory not found' });
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error('World backup error:', error);
    res.status(500).json({ error: 'Failed to create world backup' });
  }
});

app.get('/api/players', async (_req: Request, res: Response) => {
  try {
    const players = await playerManager.getPlayerList();
    res.json({ players });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get player list' });
  }
});

let metricsInterval: NodeJS.Timeout;
let consoleWatcherStarted = false;

io.on('connection', (socket) => {
  if (metricsInterval) clearInterval(metricsInterval);

  metricsInterval = setInterval(async () => {
    try {
      const metrics = await metricsCollector.getMetrics();
      io.emit('metrics:updated', metrics);
    } catch (error) {
      console.error('Error emitting metrics:', error);
    }
  }, 5000);

  // Start console watcher only once
  if (!consoleWatcherStarted) {
    consoleWatcherStarted = true;

    // Set up player update callback
    consoleManager.setPlayerManager(playerManager, (players) => {
      io.emit('players:updated', { players });
    });

    consoleManager.watchLogs((line) => {
      io.emit('console:line', line);
    }).catch((error) => {
      console.error('Error watching logs:', error);
    });
  }
});

if (NODE_ENV === 'production') {
  app.get('*', (_req: Request, res: Response) => {
    const indexPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../index.html');
    res.sendFile(indexPath);
  });
}

server.listen(PORT, () => {
  console.log(`MC Server Manager running on port ${PORT} (${NODE_ENV})`);
});
