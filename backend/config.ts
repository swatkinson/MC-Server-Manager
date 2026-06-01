import * as path from 'path';
import * as os from 'os';

function resolveMinecraftDir(): string {
  const fromEnv = process.env.MINECRAFT_DIR;
  if (fromEnv && fromEnv.trim()) return fromEnv;
  return path.join(os.homedir(), 'MinecraftServer');
}

const minecraftDir = resolveMinecraftDir();
const serverManagerDir = path.join(minecraftDir, 'mc-server-manager');
const storagePath = process.env.STORAGE_PATH || minecraftDir;

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  minecraftDir,
  logPath: process.env.LOG_PATH || path.join(minecraftDir, 'logs', 'latest.log'),
  worldPath: process.env.WORLD_PATH || path.join(minecraftDir, 'world'),
  serverPropertiesPath: process.env.SERVER_PROPERTIES_PATH || path.join(minecraftDir, 'server.properties'),
  whitelistPath: path.join(minecraftDir, 'whitelist.json'),
  opsPath: path.join(minecraftDir, 'ops.json'),
  startScript: process.env.START_SCRIPT || path.join(minecraftDir, 'start.sh'),
  // Forge/NeoForge launch JVM args from this file (referenced as @user_jvm_args.txt
  // in start.sh). When it exists, the JVM editor manages this file instead of start.sh.
  jvmArgsFile: process.env.JVM_ARGS_FILE || path.join(minecraftDir, 'user_jvm_args.txt'),
  storagePath,
  usersPath: path.join(storagePath, 'users.json'),
  restartSchedulePath: path.join(serverManagerDir, 'restart-schedule.json'),
  screenSession: process.env.MC_SCREEN_SESSION || 'minecraft',
  jwtSecret: process.env.JWT_SECRET ?? '',
  metricsIntervalMs: 5000,
  maxConsoleLogLimit: 1000,
  serverManagerDir,
  serverInfoPath: path.join(serverManagerDir, 'server-info.json'),
  auditLogPath: path.join(serverManagerDir, 'audit.log'),
  discordConfigPath: path.join(serverManagerDir, 'discord-config.json'),
  backupConfigPath: path.join(serverManagerDir, 'backup-config.json'),
  defaultBackupDir: process.env.BACKUP_DIR || path.join(minecraftDir, 'mc-server-manager-backups'),
} as const;
