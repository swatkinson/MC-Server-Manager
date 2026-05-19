import * as path from 'path';
import * as os from 'os';

function resolveMinecraftDir(): string {
  const fromEnv = process.env.MINECRAFT_DIR;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  return path.join(os.homedir(), 'MinecraftServer');
}

const minecraftDir = resolveMinecraftDir();
const serverManagerDir = path.join(minecraftDir, 'mc-server-manager');

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  minecraftDir,
  logPath: path.join(minecraftDir, 'logs', 'latest.log'),
  worldPath: path.join(minecraftDir, 'world'),
  serverPropertiesPath: path.join(minecraftDir, 'server.properties'),
  whitelistPath: path.join(minecraftDir, 'whitelist.json'),
  opsPath: path.join(minecraftDir, 'ops.json'),
  startScript: path.join(minecraftDir, 'start.sh'),
  storagePath: process.env.STORAGE_PATH || minecraftDir,
  restartSchedulePath: path.join(minecraftDir, 'mc-server-manager', 'restart-schedule.json'),
  screenSession: process.env.MC_SCREEN_SESSION || 'minecraft',
  metricsIntervalMs: 5000,
  maxConsoleLogLimit: 1000,
  serverManagerDir,
  serverInfoPath: path.join(serverManagerDir, 'server-info.json'),
} as const;
