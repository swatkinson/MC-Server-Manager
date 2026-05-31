import * as fs from 'fs/promises';
import * as path from 'path';
import { StartupScriptConfig } from '../types/index.js';
import { config } from '../config.js';

type ScriptParams = Omit<StartupScriptConfig, 'rawCommand' | 'launchMode'>;

// ── Simple mode (java ... -jar server.jar nogui) ──────────────────────────────

function parseJavaLine(line: string): ScriptParams {
  const tokens = line.replace(/^\s*java\s+/, '').split(/\s+/).filter(Boolean);

  let xms = '';
  let xmx = '';
  let jar = '';
  const extra: string[] = [];
  let skipNext = false;

  for (let i = 0; i < tokens.length; i++) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    const t = tokens[i];
    if (/^-Xms/i.test(t)) {
      xms = t.slice(4);
    } else if (/^-Xmx/i.test(t)) {
      xmx = t.slice(4);
    } else if (t === '-jar') {
      jar = tokens[i + 1] ?? '';
      skipNext = true;
    } else if (t === 'nogui') {
      // stripped — added back on reconstruct
    } else if (!t.startsWith('-') && jar) {
      // positional arg after jar — ignore
    } else if (t.startsWith('-')) {
      extra.push(t);
    }
  }

  return { xms, xmx, jar, extraFlags: extra.join(' ') };
}

function buildJavaLine(cfg: ScriptParams): string {
  const parts = ['java'];
  if (cfg.xms) parts.push(`-Xms${cfg.xms}`);
  if (cfg.xmx) parts.push(`-Xmx${cfg.xmx}`);
  if (cfg.extraFlags.trim()) parts.push(cfg.extraFlags.trim());
  if (cfg.jar) parts.push('-jar', cfg.jar, 'nogui');
  return parts.join(' ');
}

// ── Forge mode (@user_jvm_args.txt) ──────────────────────────────────────────

function parseUserJvmArgs(content: string): Omit<ScriptParams, 'jar'> {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  let xms = '';
  let xmx = '';
  const extra: string[] = [];

  for (const line of lines) {
    if (/^-Xms/i.test(line)) {
      xms = line.slice(4);
    } else if (/^-Xmx/i.test(line)) {
      xmx = line.slice(4);
    } else if (line.startsWith('-')) {
      extra.push(line);
    }
  }

  return { xms, xmx, extraFlags: extra.join(' ') };
}

function buildUserJvmArgs(cfg: Omit<ScriptParams, 'jar'>): string {
  const lines: string[] = [];
  if (cfg.xms) lines.push(`-Xms${cfg.xms}`);
  if (cfg.xmx) lines.push(`-Xmx${cfg.xmx}`);
  if (cfg.extraFlags.trim()) {
    for (const flag of cfg.extraFlags.trim().split(/\s+/)) {
      if (flag) lines.push(flag);
    }
  }
  return lines.join('\n') + '\n';
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class StartupScriptManager {
  private get userJvmArgsPath(): string {
    return path.join(path.dirname(config.startScript), 'user_jvm_args.txt');
  }

  private async detectForgeMode(): Promise<boolean> {
    try {
      const content = await fs.readFile(config.startScript, 'utf-8');
      return content.includes('@user_jvm_args.txt');
    } catch {
      return false;
    }
  }

  async read(): Promise<StartupScriptConfig> {
    if (await this.detectForgeMode()) {
      let content = '';
      try {
        content = await fs.readFile(this.userJvmArgsPath, 'utf-8');
      } catch {
        return { xms: '', xmx: '', jar: '', extraFlags: '', rawCommand: '', launchMode: 'forge' };
      }
      const parsed = parseUserJvmArgs(content);
      return { ...parsed, jar: '', rawCommand: '', launchMode: 'forge' };
    }

    let content = '';
    try {
      content = await fs.readFile(config.startScript, 'utf-8');
    } catch {
      return { xms: '', xmx: '', jar: '', extraFlags: '', rawCommand: '', launchMode: 'simple' };
    }

    const javaLine = content.split('\n').find((l) => /\bjava\b/.test(l) && /-jar/.test(l));
    if (!javaLine) {
      return { xms: '', xmx: '', jar: '', extraFlags: '', rawCommand: '', launchMode: 'simple' };
    }

    const parsed = parseJavaLine(javaLine.trim());
    return { ...parsed, rawCommand: buildJavaLine(parsed), launchMode: 'simple' };
  }

  async write(cfg: ScriptParams): Promise<void> {
    if (await this.detectForgeMode()) {
      await fs.writeFile(this.userJvmArgsPath, buildUserJvmArgs(cfg), 'utf-8');
      return;
    }

    if (!cfg.jar.trim()) {
      throw new Error('JAR filename is required');
    }

    let content = '';
    try {
      content = await fs.readFile(config.startScript, 'utf-8');
    } catch {
      content = '#!/bin/bash\n';
    }

    const newJavaLine = buildJavaLine(cfg);
    const lines = content.split('\n');
    const idx = lines.findIndex((l) => /\bjava\b/.test(l) && /-jar/.test(l));
    if (idx !== -1) {
      lines[idx] = newJavaLine;
      content = lines.join('\n');
    } else {
      content = content.trimEnd() + '\n' + newJavaLine + '\n';
    }

    await fs.writeFile(config.startScript, content, 'utf-8');
  }

  buildPreview(cfg: ScriptParams): string {
    return buildJavaLine(cfg);
  }
}
