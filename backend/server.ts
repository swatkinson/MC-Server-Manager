import express, { Router, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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
import { runPreflightChecks } from './services/PreflightChecker.js';
import { TpsTracker } from './services/TpsTracker.js';
import { PortForwardChecker } from './services/PortForwardChecker.js';
import { ServerInfoStore } from './services/ServerInfoStore.js';
import { StartupScriptManager } from './services/StartupScriptManager.js';
import { RestartScheduler } from './services/RestartScheduler.js';
import { UserStore } from './services/UserStore.js';
import { AuthService, COOKIE_NAME } from './services/AuthService.js';
import { requireAuth } from './middleware/requireAuth.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { config } from './config.js';

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  console.error('FATAL: JWT_SECRET env var must be set and at least 32 characters');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distRoot = path.join(__dirname, '..');

const app = express();
const httpServer = createServer(app);

const devOrigins = ['http://localhost:5173'];
const io = new Server(httpServer, {
  cors: config.isProduction
    ? {}
    : { origin: devOrigins, credentials: true, methods: ['GET', 'POST'] },
});

const infoStore = new ServerInfoStore();
const serverManager = new ServerManager(infoStore);
const metricsCollector = new MetricsCollector();
const consoleManager = new ConsoleManager();
const configManager = new ConfigManager();
const playerManager = new PlayerManager();
const tpsTracker = new TpsTracker(consoleManager);
const portForwardChecker = new PortForwardChecker();
const startupScriptManager = new StartupScriptManager();
const restartScheduler = new RestartScheduler(
  serverManager,
  (schedule) => io.emit('scheduler:updated', schedule),
);
const userStore = new UserStore();
const authService = new AuthService();

metricsCollector.setTpsProvider(() => tpsTracker.getMetrics());

app.use(
  cors(
    config.isProduction
      ? { origin: false }
      : { origin: devOrigins, credentials: true, methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] },
  ),
);
app.use(cookieParser());
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

function isValidUsername(u: unknown): u is string {
  return typeof u === 'string' && /^[a-zA-Z0-9_]{3,32}$/.test(u);
}

function isValidPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 8 && p.length <= 128;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many setup attempts, try again later' },
});

// ── Public routes ──────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get(
  '/api/health/preflight',
  asyncRoute(async (_req, res) => {
    try {
      const checks = await runPreflightChecks();
      res.json({ checks });
    } catch (error) {
      fail(res, 500, 'Failed to run preflight checks', error);
    }
  }),
);

app.get(
  '/api/auth/setup',
  asyncRoute(async (_req, res) => {
    const setupRequired = await userStore.isEmpty();
    res.json({ setupRequired });
  }),
);

app.post(
  '/api/auth/setup',
  setupLimiter,
  asyncRoute(async (req, res) => {
    if (!(await userStore.isEmpty())) {
      res.status(403).json({ error: 'Setup already completed' });
      return;
    }
    const { username, password } = req.body ?? {};
    if (!isValidUsername(username)) {
      fail(res, 400, 'Username must be 3–32 characters (letters, numbers, underscore)');
      return;
    }
    if (!isValidPassword(password)) {
      fail(res, 400, 'Password must be 8–128 characters');
      return;
    }
    const hash = await authService.hashPassword(password as string);
    const user = await userStore.create(username as string, hash);
    const token = authService.signToken(user);
    res.cookie(COOKIE_NAME, token, authService.cookieOptions(config.isProduction));
    res.status(201).json({ user: { id: user.id, username: user.username, role: user.role } });
  }),
);

app.post(
  '/api/auth/login',
  loginLimiter,
  asyncRoute(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      fail(res, 400, 'Username and password are required');
      return;
    }
    const user = await userStore.getByUsername(username);
    if (!user || !(await authService.verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = authService.signToken(user);
    res.cookie(COOKIE_NAME, token, authService.cookieOptions(config.isProduction));
    res.json({ user: { id: user.id, username: user.username, role: user.role } });
  }),
);

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, authService.cookieOptions(config.isProduction));
  res.json({ ok: true });
});

// ── Protected routes ────────────────────────────────────────────────────────

const api = Router();
api.use(requireAuth(authService));

api.get(
  '/api/auth/me',
  asyncRoute(async (req, res) => {
    res.json({ user: req.user });
  }),
);

api.get(
  '/api/auth/users',
  asyncRoute(async (_req, res) => {
    const users = await userStore.getAll();
    res.json({
      users: users.map((u) => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt })),
    });
  }),
);

api.post(
  '/api/auth/users',
  asyncRoute(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (!isValidUsername(username)) {
      fail(res, 400, 'Username must be 3–32 characters (letters, numbers, underscore)');
      return;
    }
    if (!isValidPassword(password)) {
      fail(res, 400, 'Password must be 8–128 characters');
      return;
    }
    const existing = await userStore.getByUsername(username as string);
    if (existing) {
      fail(res, 409, 'Username already taken');
      return;
    }
    const hash = await authService.hashPassword(password as string);
    const user = await userStore.create(username as string, hash);
    res.status(201).json({ user: { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt } });
  }),
);

api.delete(
  '/api/auth/users/:id',
  asyncRoute(async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (req.user?.sub === id) {
      fail(res, 400, 'Cannot delete your own account');
      return;
    }
    const deleted = await userStore.delete(id);
    if (!deleted) {
      fail(res, 404, 'User not found');
      return;
    }
    res.json({ ok: true });
  }),
);

api.get(
  '/api/server/status',
  asyncRoute(async (_req, res) => {
    try {
      res.json(await serverManager.getStatus());
    } catch (error) {
      fail(res, 500, 'Failed to get server status', error);
    }
  }),
);

api.post(
  '/api/server/start',
  asyncRoute(async (_req, res) => {
    try {
      const result = await serverManager.start();
      io.emit('server:status:changed', result);
      if (result.success) {
        portForwardChecker.scheduleStartupCheck((checkResult) => {
          io.emit('portforward:result', checkResult);
        });
      }
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to start server', error);
    }
  }),
);

api.post(
  '/api/server/stop',
  asyncRoute(async (_req, res) => {
    try {
      const result = await serverManager.stop();
      if (result.success) playerManager.clearAll();
      portForwardChecker.cancelStartupCheck();
      io.emit('server:status:changed', result);
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to stop server', error);
    }
  }),
);

api.post(
  '/api/server/restart',
  asyncRoute(async (_req, res) => {
    try {
      const result = await serverManager.restart();
      io.emit('server:status:changed', result);
      if (result.success) {
        portForwardChecker.scheduleStartupCheck((checkResult) => {
          io.emit('portforward:result', checkResult);
        });
      }
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to restart server', error);
    }
  }),
);

api.get(
  '/api/server/portforward/check',
  asyncRoute(async (_req, res) => {
    try {
      const result = await portForwardChecker.check();
      io.emit('portforward:result', result);
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to run port-forward check', error);
    }
  }),
);

api.get(
  '/api/server/public-ip',
  asyncRoute(async (_req, res) => {
    try {
      const publicIp = await portForwardChecker.getPublicIp();
      res.json({ publicIp });
    } catch (error) {
      fail(res, 500, 'Failed to get public IP', error);
    }
  }),
);

api.get(
  '/api/server/info',
  asyncRoute(async (_req, res) => {
    try {
      const info = (await infoStore.read()) ?? { version: 'unknown', serverType: 'unknown', updatedAt: 0 };
      res.json(info);
    } catch (error) {
      fail(res, 500, 'Failed to get server info', error);
    }
  }),
);

api.get(
  '/api/metrics',
  asyncRoute(async (_req, res) => {
    try {
      res.json(await metricsCollector.getMetrics());
    } catch (error) {
      fail(res, 500, 'Failed to get metrics', error);
    }
  }),
);

api.get(
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

api.post(
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
      await consoleManager.executeCommand(command);
      res.json({ success: true });
    } catch (error) {
      fail(res, 500, 'Failed to execute command', error);
    }
  }),
);

api.get(
  '/api/config/server-properties',
  asyncRoute(async (_req, res) => {
    try {
      res.json(await configManager.getServerProperties());
    } catch (error) {
      fail(res, 500, 'Failed to get server properties', error);
    }
  }),
);

api.post(
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

api.get(
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

api.post(
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

api.delete(
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

api.get(
  '/api/config/startup-script',
  asyncRoute(async (_req, res) => {
    try {
      res.json(await startupScriptManager.read());
    } catch (error) {
      fail(res, 500, 'Failed to read startup script', error);
    }
  }),
);

api.post(
  '/api/config/startup-script',
  asyncRoute(async (req, res) => {
    const { xms, xmx, jar, extraFlags } = req.body ?? {};
    if (typeof jar !== 'string' || !jar.trim()) {
      fail(res, 400, 'JAR filename is required');
      return;
    }
    try {
      await startupScriptManager.write({
        xms: typeof xms === 'string' ? xms.trim() : '',
        xmx: typeof xmx === 'string' ? xmx.trim() : '',
        jar: jar.trim(),
        extraFlags: typeof extraFlags === 'string' ? extraFlags.trim() : '',
      });
      res.json({ success: true });
    } catch (error) {
      fail(res, 500, 'Failed to write startup script', error);
    }
  }),
);

api.get(
  '/api/scheduler/restart',
  asyncRoute(async (_req, res) => {
    res.json({ schedule: restartScheduler.getSchedule() });
  }),
);

api.post(
  '/api/scheduler/restart',
  asyncRoute(async (req, res) => {
    const result = await restartScheduler.setSchedule(req.body ?? {});
    res.status(result.success ? 200 : 400).json(result);
  }),
);

api.post(
  '/api/scheduler/restart/now',
  asyncRoute(async (_req, res) => {
    try {
      const result = await serverManager.restart();
      io.emit('server:status:changed', result);
      if (result.success) {
        portForwardChecker.scheduleStartupCheck((checkResult) => {
          io.emit('portforward:result', checkResult);
        });
      }
      res.json(result);
    } catch (error) {
      fail(res, 500, 'Failed to restart server', error);
    }
  }),
);

api.post(
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

api.get(
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

app.use(api);

// ── Socket.IO ────────────────────────────────────────────────────────────────

io.use(socketAuthMiddleware(authService));

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
    const consumedByTps = tpsTracker.observe(line);
    if (!consumedByTps) io.emit('console:line', line);
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

// ── Production SPA catch-all ─────────────────────────────────────────────────

if (config.isProduction) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distRoot, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

restartScheduler.init().catch((err) => {
  console.error('Failed to initialize restart scheduler:', err);
});

httpServer.listen(config.port, () => {
  console.log(`MC Server Manager running on port ${config.port} (${config.nodeEnv})`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down gracefully...`);
  if (metricsInterval) clearInterval(metricsInterval);
  consoleManager.stop();
  tpsTracker.stop();
  portForwardChecker.cancelStartupCheck();
  restartScheduler.stop();
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
