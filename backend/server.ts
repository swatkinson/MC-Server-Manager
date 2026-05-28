import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import { ServerManager } from './services/ServerManager.js';
import { MetricsCollector } from './services/MetricsCollector.js';
import { ConsoleManager } from './services/ConsoleManager.js';
import { ConfigManager } from './services/ConfigManager.js';
import { PlayerManager } from './services/PlayerManager.js';
import { TpsTracker } from './services/TpsTracker.js';
import { PortForwardChecker } from './services/PortForwardChecker.js';
import { ServerInfoStore } from './services/ServerInfoStore.js';
import { StartupScriptManager } from './services/StartupScriptManager.js';
import { RestartScheduler } from './services/RestartScheduler.js';
import { UserStore } from './services/UserStore.js';
import { AuthService } from './services/AuthService.js';
import { AuditLogger } from './services/AuditLogger.js';
import { DiscordNotifier } from './services/DiscordNotifier.js';
import { BackupService } from './services/BackupService.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { config } from './config.js';
import { createHealthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createServerRouter } from './routes/serverRoutes.js';
import { createConsoleRouter } from './routes/console.js';
import { createConfigRouter } from './routes/configRoutes.js';
import { createMetricsRouter } from './routes/metrics.js';
import { createPlayersRouter } from './routes/players.js';
import { createBackupsRouter } from './routes/backups.js';
import { createWebhooksRouter } from './routes/webhooks.js';
import { createAuditRouter } from './routes/audit.js';
import { createSchedulerRouter } from './routes/scheduler.js';

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
    : { origin: devOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] },
});

// ── Service instantiation ────────────────────────────────────────────────────

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
const auditLogger = new AuditLogger(config.auditLogPath);
const discordNotifier = new DiscordNotifier(config.discordConfigPath);
const backupService = new BackupService(config.backupConfigPath, config.minecraftDir, config.defaultBackupDir);

metricsCollector.setTpsProvider(() => tpsTracker.getMetrics());
tpsTracker.setRunningProbe(() => serverManager.isRunning());
tpsTracker.setServerTypeProvider(() => infoStore.getServerType());
tpsTracker.start();

// ── App middleware ───────────────────────────────────────────────────────────

app.use(
  cors(
    config.isProduction
      ? { origin: false }
      : { origin: devOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] },
  ),
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

if (config.isProduction) {
  app.use(express.static(distRoot, { index: false }));
}

// ── Public routes ────────────────────────────────────────────────────────────

app.use(createHealthRouter());
app.use(createAuthRouter(userStore, authService, auditLogger));

// ── Production SPA catch-all ─────────────────────────────────────────────────
// Must be before protected routes — requireAuth on api routers would block
// unauthenticated users from ever receiving index.html.

if (config.isProduction) {
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distRoot, 'index.html'));
  });
}

// ── Protected routes ─────────────────────────────────────────────────────────

app.use(createServerRouter(serverManager, portForwardChecker, auditLogger, discordNotifier, playerManager, configManager, authService, io, infoStore));
app.use(createConsoleRouter(consoleManager, auditLogger, authService));
app.use(createConfigRouter(configManager, startupScriptManager, auditLogger, authService, io));
app.use(createMetricsRouter(metricsCollector, authService));
app.use(createPlayersRouter(playerManager, authService));
app.use(createBackupsRouter(backupService, auditLogger, authService));
app.use(createWebhooksRouter(discordNotifier, auditLogger, authService));
app.use(createAuditRouter(auditLogger, authService));
app.use(createSchedulerRouter(restartScheduler, serverManager, portForwardChecker, authService, io));

// ── Global error handler ─────────────────────────────────────────────────────

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

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

// ── Lifecycle hooks ──────────────────────────────────────────────────────────

restartScheduler.onBeforeRestart = () => {
  void discordNotifier.onScheduledRestart();
};
restartScheduler.onAfterRestart = () => {
  void discordNotifier.onRestartComplete();
};

restartScheduler.init().catch((err) => {
  console.error('Failed to initialize restart scheduler:', err);
});

backupService.onBackupComplete = (info) => {
  void discordNotifier.onBackupSuccess(info.filename, info.sizeBytes);
};
backupService.onBackupFailed = (error) => {
  void discordNotifier.onBackupFailed(error);
};

backupService.init().catch((err) => {
  console.error('Failed to initialize backup service:', err);
});

// ── HTTP server ──────────────────────────────────────────────────────────────

httpServer.listen(config.port, () => {
  console.log(`MC Server Manager running on port ${config.port} (${config.nodeEnv})`);
});

// ── Shutdown ─────────────────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down gracefully...`);
  if (metricsInterval) clearInterval(metricsInterval);
  consoleManager.stop();
  tpsTracker.stop();
  portForwardChecker.cancelStartupCheck();
  restartScheduler.stop();
  backupService.stop();
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
