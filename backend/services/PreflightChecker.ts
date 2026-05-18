import * as fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

export type PreflightSeverity = 'ok' | 'warn' | 'error';

export interface PreflightCheck {
  id: string;
  label: string;
  severity: PreflightSeverity;
  message: string;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function isExecutable(target: string): Promise<boolean> {
  try {
    await fs.access(target, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function which(binary: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', [binary]);
    const resolved = stdout.trim();
    return resolved || null;
  } catch {
    return null;
  }
}

async function checkMinecraftDir(): Promise<PreflightCheck> {
  if (!(await pathExists(config.minecraftDir))) {
    return {
      id: 'minecraft-dir',
      label: 'Minecraft directory',
      severity: 'error',
      message: `Directory not found at ${config.minecraftDir}. Set MINECRAFT_DIR to override.`,
    };
  }
  return {
    id: 'minecraft-dir',
    label: 'Minecraft directory',
    severity: 'ok',
    message: config.minecraftDir,
  };
}

async function checkStartScript(): Promise<PreflightCheck> {
  if (!(await pathExists(config.startScript))) {
    return {
      id: 'start-script',
      label: 'Start script',
      severity: 'error',
      message: `start.sh not found at ${config.startScript}. Create one that launches the server inside \`screen -S ${config.screenSession}\`.`,
    };
  }
  if (!(await isExecutable(config.startScript))) {
    return {
      id: 'start-script',
      label: 'Start script',
      severity: 'error',
      message: `start.sh exists but is not executable. Run \`chmod +x ${config.startScript}\`.`,
    };
  }
  return {
    id: 'start-script',
    label: 'Start script',
    severity: 'ok',
    message: config.startScript,
  };
}

async function checkServerProperties(): Promise<PreflightCheck> {
  if (!(await pathExists(config.serverPropertiesPath))) {
    return {
      id: 'server-properties',
      label: 'server.properties',
      severity: 'warn',
      message:
        'server.properties not found yet. Minecraft will create it on first launch with defaults.',
    };
  }
  return {
    id: 'server-properties',
    label: 'server.properties',
    severity: 'ok',
    message: config.serverPropertiesPath,
  };
}

async function checkWorld(): Promise<PreflightCheck> {
  if (!(await pathExists(config.worldPath))) {
    return {
      id: 'world-dir',
      label: 'World directory',
      severity: 'warn',
      message: 'World directory does not exist yet — it will be created on first launch.',
    };
  }
  return {
    id: 'world-dir',
    label: 'World directory',
    severity: 'ok',
    message: config.worldPath,
  };
}

async function checkBinary(
  id: string,
  binary: string,
  severity: PreflightSeverity,
  purpose: string,
): Promise<PreflightCheck> {
  const resolved = await which(binary);
  if (!resolved) {
    return {
      id,
      label: binary,
      severity,
      message: `\`${binary}\` is not on PATH. Needed to ${purpose}.`,
    };
  }
  return {
    id,
    label: binary,
    severity: 'ok',
    message: resolved,
  };
}

async function checkScreenSessionRunning(): Promise<PreflightCheck> {
  try {
    const { stdout } = await execFileAsync('screen', ['-ls']);
    const hasSession = stdout.split('\n').some((line) => line.includes(`.${config.screenSession}\t`) || line.includes(`.${config.screenSession} `));
    if (hasSession) {
      return {
        id: 'screen-session',
        label: 'Screen session',
        severity: 'ok',
        message: `Active screen session "${config.screenSession}" found.`,
      };
    }
    return {
      id: 'screen-session',
      label: 'Screen session',
      severity: 'warn',
      message: `No active "${config.screenSession}" screen session. Start the server to create it; console input requires the server to run inside this session.`,
    };
  } catch {
    return {
      id: 'screen-session',
      label: 'Screen session',
      severity: 'warn',
      message: 'Could not list screen sessions.',
    };
  }
}

export async function runPreflightChecks(): Promise<PreflightCheck[]> {
  return Promise.all([
    checkMinecraftDir(),
    checkStartScript(),
    checkServerProperties(),
    checkWorld(),
    checkBinary('bin-java', 'java', 'error', 'run the Minecraft server'),
    checkBinary('bin-screen', 'screen', 'error', 'send console commands and detach the server'),
    checkBinary('bin-pgrep', 'pgrep', 'error', 'detect whether the server process is running'),
    checkBinary('bin-pkill', 'pkill', 'error', 'force-stop the server if it does not respond'),
    checkBinary('bin-jstat', 'jstat', 'warn', 'read JVM heap metrics (gauge will fall back to system RAM only without it)'),
    checkScreenSessionRunning(),
  ]);
}
