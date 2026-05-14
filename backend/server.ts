import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { ServerManager } from './services/ServerManager.js';
import { MetricsCollector } from './services/MetricsCollector.js';
import { ConsoleManager, isValidCommand } from './services/ConsoleManager.js';
import { ConfigManager, isValidUuid } from './services/ConfigManager.js';
import { PlayerManager } from './services/PlayerManager.js';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distRoot = path.join(__dirname, '..');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const serverManager = new ServerManager();
const metricsCollector = new MetricsCollector();
const consoleManager = new ConsoleManager();
const configManager = new ConfigManager();
const playerManager = new PlayerManager();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

if (config.isProduction) {
  app.use(express.static(distRoot, { index: false }));
}

function fail(res: Response, status: number, message: string, error?: unknown): void {
  if (error) console.error(message, error);
  res.status(status).json({ error: message });
}

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get(
  '/api/server/status',
  asyncRoute(async (_req, res) => {
    try {
      res.json(await serverManager.getStatus());
    } catch (error) {
      fail(res, 500, 'Failed to get server status', error);
    }
  }),
);

app.post(
  '/api/server/start',
  asyncRoute(async (_req, res) => {
    try {
      const result = await serverManager.start();
      io.emit('server:status:changed', result);
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to start server', error);
    }
  }),
);

app.post(
  '/api/server/stop',
  asyncRoute(async (_req, res) => {
    try {
      const result = await serverManager.stop();
      if (result.success) playerManager.clearAll();
      io.emit('server:status:changed', result);
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to stop server', error);
    }
  }),
);

app.post(
  '/api/server/restart',
  asyncRoute(async (_req, res) => {
    try {
      const result = await serverManager.restart();
      io.emit('server:status:changed', result);
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to restart server', error);
    }
  }),
);

app.get(
  '/api/metrics',
  asyncRoute(async (_req, res) => {
    try {
      res.json(await metricsCollector.getMetrics());
    } catch (error) {
      fail(res, 500, 'Failed to get metrics', error);
    }
  }),
);

app.get(
  '/api/console/logs',
  asyncRoute(async (req, res) => {
    try {
      const requested = parseInt(req.query.limit as string, 10);
      const limit = Number.isFinite(requested) ? requested : 50;
      const logs = await consoleManager.getLogs(limit);
      res.json({ logs });
    } catch (error) {
      fail(res, 500, 'Failed to get console logs', error);
    }
  }),
);

app.post(
  '/api/console/command',
  asyncRoute(async (req, res) => {
    const { command } = req.body ?? {};
    if (!command || typeof command !== 'string') {
      fail(res, 400, 'Command is required');
      return;
    }
    if (!isValidCommand(command)) {
      fail(res, 400, 'Command contains invalid characters');
      return;
    }
    try {
      const output = await consoleManager.executeCommand(command);
      io.emit('console:command:executed', { command, output });
      res.json({ success: true, output });
    } catch (error) {
      fail(res, 500, 'Failed to execute command', error);
    }
  }),
);

app.get(
  '/api/config/server-properties',
  asyncRoute(async (_req, res) => {
    try {
      res.json(await configManager.getServerProperties());
    } catch (error) {
      fail(res, 500, 'Failed to get server properties', error);
    }
  }),
);

app.post(
  '/api/config/server-properties',
  asyncRoute(async (req, res) => {
    const { properties } = req.body ?? {};
    if (!properties || typeof properties !== 'object') {
      fail(res, 400, 'Properties object is required');
      return;
    }
    try {
      const result = await configManager.setServerProperties(properties);
      if (result.success) io.emit('config:updated', properties);
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to update server properties', error);
    }
  }),
);

app.get(
  '/api/config/whitelist',
  asyncRoute(async (_req, res) => {
    try {
      const [entries, enabled] = await Promise.all([
        configManager.getWhitelist(),
        configManager.isWhitelistEnabled(),
      ]);
      res.json({ entries, enabled });
    } catch (error) {
      fail(res, 500, 'Failed to get whitelist', error);
    }
  }),
);

app.post(
  '/api/config/whitelist',
  asyncRoute(async (req, res) => {
    const { uuid, name, entries, enabled } = req.body ?? {};
    try {
      let result;
      if (Array.isArray(entries)) {
        result = await configManager.setWhitelist(entries);
      } else if (enabled !== undefined) {
        result = await configManager.setWhitelistEnabled(Boolean(enabled));
      } else {
        result = await configManager.addToWhitelist(uuid, name);
      }

      if (result.success) {
        const updatedEntries = await configManager.getWhitelist();
        const updatedEnabled = await configManager.isWhitelistEnabled();
        io.emit('whitelist:updated', { entries: updatedEntries, enabled: updatedEnabled });
      }
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      fail(res, 500, 'Failed to update whitelist', error);
    }
  }),
);

app.delete(
  '/api/config/whitelist/:uuid',
  asyncRoute(async (req, res) => {
    const rawUuid = req.params.uuid;
    const uuid = Array.isArray(rawUuid) ? rawUuid[0] : rawUuid;
    if (typeof uuid !== 'string' || !isValidUuid(uuid)) {
      fail(res, 400, 'Invalid UUID format');
      return;
    }
    try {
      const result = await configManager.removeFromWhitelist(uuid);
      if (result.success) {
        const updatedEntries = await configManager.getWhitelist();
        const updatedEnabled = await configManager.isWhitelistEnabled();
        io.emit('whitelist:updated', { entries: updatedEntries, enabled: updatedEnabled });
      }
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      fail(res, 500, 'Failed to remove from whitelist', error);
    }
  }),
);

app.post(
  '/api/server/world-backup',
  asyncRoute(async (_req, res) => {
    if (!fs.existsSync(config.worldPath)) {
      fail(res, 400, 'World directory not found');
      return;
    }

    res.setHeader('Content-Type', 'application/gzip');
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename="world-backup-${date}.tar.gz"`);

    const archive = archiver('tar', { gzip: true });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create backup archive' });
      } else {
        res.end();
      }
    });

    archive.pipe(res);
    archive.directory(config.worldPath, 'world');

    try {
      await archive.finalize();
    } catch (error) {
      console.error('World backup error:', error);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to create world backup' });
    }
  }),
);

app.get(
  '/api/players',
  asyncRoute(async (_req, res) => {
    try {
      const players = await playerManager.getPlayerList();
      res.json({ players });
    } catch (error) {
      fail(res, 500, 'Failed to get player list', error);
    }
  }),
);

let metricsInterval: NodeJS.Timeout | null = null;

function startMetricsLoop(): void {
  if (metricsInterval) return;
  metricsInterval = setInterval(async () => {
    if (io.sockets.sockets.size === 0) return;
    try {
      io.emit('metrics:updated', await metricsCollector.getMetrics());
    } catch (error) {
      console.error('Error emitting metrics:', error);
    }
  }, config.metricsIntervalMs);
}

consoleManager.setPlayerManager(playerManager, (players) => {
  io.emit('players:updated', { players });
});

consoleManager
  .watchLogs((line) => {
    io.emit('console:line', line);
  })
  .catch((error) => {
    console.error('Error watching logs:', error);
  });

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  startMetricsLoop();

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

if (config.isProduction) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distRoot, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

httpServer.listen(config.port, () => {
  console.log(`MC Server Manager running on port ${config.port} (${config.nodeEnv})`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down gracefully...`);
  if (metricsInterval) clearInterval(metricsInterval);
  consoleManager.stop();
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
