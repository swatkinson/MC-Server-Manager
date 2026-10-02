export interface ServerStatus {
  status: 'online' | 'offline' | 'starting' | 'stopping';
  uptime: number;
  version: string;
  motd: string;
  ip: string;
  players: {
    current: number;
    max: number;
  };
}

export interface LogLine {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  source?: string;
}

export interface Player {
  uuid: string;
  name: string;
  ip: string;
  joinTime: number;
  isOp: boolean;
}

export type JvmPressure = 'ok' | 'elevated' | 'critical';

// Memory as seen from inside the Minecraft JVM (see backend JvmInspector).
export interface JvmMemory {
  source: 'hsperfdata' | 'rss';
  heapUsed: number; // everything in the heap now, incl. garbage awaiting the next GC
  heapLive: number; // old gen + survivors — what survived the last GC
  heapCommitted: number;
  heapMax: number | null;
  metaspaceUsed: number;
  rss: number | null; // physical RAM the OS has given the JVM process
  gcPausePercent: number | null; // share of wall time spent in GC pauses (last ~60 s)
  youngGcPerMin: number | null;
  fullGcCount: number;
  lastFullGcAgoSec: number | null;
  pressure: JvmPressure;
  pressureReason: string;
}

export interface JvmSample {
  t: number;
  heapUsed: number;
  heapLive: number;
  heapCommitted: number;
  gcPausePercent: number | null;
}

export interface TpsMetrics {
  tps: number | null;
  mspt: number | null;
  headroomPercent: number | null;
  source: 'paper' | 'forge' | 'spark' | null;
  lastUpdatedMs: number;
}

export interface SystemMetrics {
  cpu: {
    percentage: number;
    cores: number[];
  };
  ram: {
    total: number;
    used: number;
    percentage: number;
    jvm: JvmMemory | null;
    systemOther: number;
  };
  storage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  tps: TpsMetrics | null;
}

export interface PortForwardCheckResult {
  ok: boolean | null;
  publicIp: string | null;
  port: number;
  checkedAt: number;
  message: string;
}

export interface ServerConfig {
  motd: string;
  levelName: string;
  maxPlayers: number;
  difficulty: string;
  gameMode: string;
  [key: string]: string | number | boolean;
}

export interface WhitelistEntry {
  uuid: string;
  name: string;
}

export interface WhitelistData {
  entries: WhitelistEntry[];
  enabled: boolean;
}

export type ServerType =
  | 'vanilla'
  | 'paper'
  | 'purpur'
  | 'spigot'
  | 'craftbukkit'
  | 'fabric'
  | 'forge'
  | 'unknown';

export interface ServerInfo {
  version: string;
  serverType: ServerType;
  updatedAt: number;
}

export interface StartupScriptConfig {
  xms: string;
  xmx: string;
  jar: string;
  extraFlags: string;
  rawCommand: string;
  launchMode: 'simple' | 'forge';
}

export interface RestartSchedule {
  enabled: boolean;
  hour: number;
  minute: number;
  nextRestart: string | null;
}

export interface RestartScheduleResult {
  success: boolean;
  message: string;
  schedule?: RestartSchedule;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'moderator' | 'user';
  createdAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  role: 'admin' | 'moderator' | 'user';
  createdAt: number;
}

export interface TokenPayload {
  sub: string;
  username: string;
  role: 'admin' | 'moderator' | 'user';
  iat: number;
  exp: number;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string | null;
  username: string | null;
  role: 'admin' | 'moderator' | 'user' | null;
  action: string;
  details: Record<string, unknown>;
}

export interface DiscordWebhookConfig {
  webhookUrl: string;
  enabled: boolean;
  events: {
    serverStart: boolean;
    serverStop: boolean;
    serverCrash: boolean;
    scheduledRestart: boolean;
    backupSuccess: boolean;
    backupFailed: boolean;
  };
}

export interface BackupGatewayConfig {
  host: string; // user@host of the machine running mc-backup-gateway
  keyPath: string; // private key whose authorized_keys entry forces the gateway
}

export interface BackupArchive {
  filename: string;
  sizeBytes: number;
  createdAt: number; // Unix ms
}

export interface HostBackupStatus {
  configured: boolean;
  reachable: boolean;
  error: string | null;
  host: string;
  server: string;
  keep: number;
  archives: BackupArchive[]; // newest first
  lastRun: { state: 'running' | 'ok' | 'failed'; startedAt: number; finishedAt: number | null; message: string } | null; // seconds
  running: boolean;
  restoring: boolean;
  schedule: { nextRunAt: number | null; lastRunAt: number | null }; // Unix ms
  disk: { total: number; free: number } | null;
}

export interface ModConfigFile {
  path: string; // relative to its root, forward slashes
  size: number;
  mtimeMs: number;
}

export interface ModConfigRoot {
  id: string;
  label: string;
  description: string;
  files: ModConfigFile[];
}

export interface ModConfigVersion {
  id: string;
  savedAt: number; // Unix ms
  size: number;
}
