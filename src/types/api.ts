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
  source: 'paper' | 'forge' | null;
  lastUpdatedMs: number;
}

export interface SystemMetrics {
  cpu: {
    percentage: number;
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

export interface ConsoleLogsResponse {
  logs: LogLine[];
}

export interface ConsoleCommandResponse {
  success: boolean;
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

export interface WhitelistEntry {
  uuid: string;
  name: string;
}

export interface WhitelistData {
  entries: WhitelistEntry[];
  enabled: boolean;
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

export interface PublicUser {
  id: string;
  username: string;
  role: 'admin';
  createdAt: number;
}

export interface LoginResponse {
  user: PublicUser;
}

export interface SetupCheckResponse {
  setupRequired: boolean;
}

export interface UsersListResponse {
  users: PublicUser[];
}
