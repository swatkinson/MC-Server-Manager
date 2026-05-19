import * as fs from 'fs/promises';
import { StartupScriptConfig } from '../types/index.js';
import { config } from '../config.js';

function parseJavaLine(line: string): Omit<StartupScriptConfig, 'rawCommand'> {
  // Tokenise the line, stripping leading 'java'
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
      // strip — we add it back on reconstruct
    } else if (!t.startsWith('-') && jar) {
      // positional arg after jar (e.g. "nogui" variant spellings) — ignore
    } else if (t.startsWith('-')) {
      extra.push(t);
    }
  }

  return { xms, xmx, jar, extraFlags: extra.join(' ') };
}

function buildJavaLine(cfg: Omit<StartupScriptConfig, 'rawCommand'>): string {
  const parts = ['java'];
  if (cfg.xms) parts.push(`-Xms${cfg.xms}`);
  if (cfg.xmx) parts.push(`-Xmx${cfg.xmx}`);
  if (cfg.extraFlags.trim()) parts.push(cfg.extraFlags.trim());
  if (cfg.jar) parts.push('-jar', cfg.jar, 'nogui');
  return parts.join(' ');
}

export class StartupScriptManager {
  async read(): Promise<StartupScriptConfig> {
    let content = '';
    try {
      content = await fs.readFile(config.startScript, 'utf-8');
    } catch {
      return { xms: '', xmx: '', jar: '', extraFlags: '', rawCommand: '' };
    }

    const javaLine = content.split('\n').find((l) => /\bjava\b/.test(l) && /-jar/.test(l));
    if (!javaLine) {
      return { xms: '', xmx: '', jar: '', extraFlags: '', rawCommand: '' };
    }

    const parsed = parseJavaLine(javaLine.trim());
    return { ...parsed, rawCommand: buildJavaLine(parsed) };
  }

  async write(cfg: Omit<StartupScriptConfig, 'rawCommand'>): Promise<void> {
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

  buildPreview(cfg: Omit<StartupScriptConfig, 'rawCommand'>): string {
    return buildJavaLine(cfg);
  }
}
