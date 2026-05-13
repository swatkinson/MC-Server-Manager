import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
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

const serverManager = new ServerManager();
const metricsCollector = new MetricsCollector();
const consoleManager = new ConsoleManager();
const configManager = new ConfigManager();
const playerManager = new PlayerManager();

app.use(express.json());
app.use(cors());

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/server/status', async (req, res) => {
  try {
    const status = await serverManager.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get server status' });
  }
});

app.post('/api/server/start', async (req, res) => {
  try {
    const result = await serverManager.start();
    io.emit('server:status:changed', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start server' });
  }
});

app.post('/api/server/stop', async (req, res) => {
  try {
    const result = await serverManager.stop();
    io.emit('server:status:changed', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop server' });
  }
});

app.post('/api/server/restart', async (req, res) => {
  try {
    const result = await serverManager.restart();
    io.emit('server:status:changed', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to restart server' });
  }
});

app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await metricsCollector.getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

app.get('/api/console/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await consoleManager.getLogs(limit);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get console logs' });
  }
});

app.post('/api/console/command', async (req, res) => {
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

app.get('/api/config/server-properties', async (req, res) => {
  try {
    const properties = await configManager.getServerProperties();
    res.json({ properties });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get server properties' });
  }
});

app.post('/api/config/server-properties', async (req, res) => {
  try {
    const result = await configManager.setServerProperties(req.body.properties);
    io.emit('config:updated', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update server properties' });
  }
});

app.get('/api/config/whitelist', async (req, res) => {
  try {
    const entries = await configManager.getWhitelist();
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get whitelist' });
  }
});

app.post('/api/config/whitelist', async (req, res) => {
  try {
    const { uuid, name } = req.body;
    const result = await configManager.addToWhitelist(uuid, name);
    if (result.success) {
      io.emit('whitelist:updated', { action: 'added', uuid, name });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add to whitelist' });
  }
});

app.delete('/api/config/whitelist/:uuid', async (req, res) => {
  try {
    const result = await configManager.removeFromWhitelist(req.params.uuid);
    if (result.success) {
      io.emit('whitelist:updated', { action: 'removed', uuid: req.params.uuid });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove from whitelist' });
  }
});

app.get('/api/players', async (req, res) => {
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

server.listen(PORT, () => {
  console.log(`MC Server Manager backend running on port ${PORT}`);
});
