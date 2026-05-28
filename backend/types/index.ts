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

export interface JvmHeap {
  heapUsed: number;
  heapCommitted: number;
  heapMax: number;
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
    jvm: JvmHeap | null;
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

export interface BackupConfig {
  backupDir: string;
  schedule: {
    enabled: boolean;
    hour: number;
    minute: number;
  };
  keepCount: number;
}

export interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: number;
}

export interface BackupResult {
  success: boolean;
  filename?: string;
  sizeBytes?: number;
  error?: string;
}
