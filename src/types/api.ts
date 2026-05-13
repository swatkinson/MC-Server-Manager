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

export interface SystemMetrics {
  cpu: {
    percentage: number;
    jvmPercentage: number;
    otherPercentage: number;
  };
  ram: {
    total: number;
    used: number;
    jvmAllocated: number;
    jvmUsed: number;
    percentage: number;
  };
  storage: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
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
  output: string;
}
