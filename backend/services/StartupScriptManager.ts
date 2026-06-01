import * as fs from 'fs/promises';
import { StartupScriptConfig } from '../types/index.js';
import { config } from '../config.js';

type StartupScriptInput = Omit<StartupScriptConfig, 'rawCommand'>;
type ParsedScript = Omit<StartupScriptInput, 'mode'>;

// --- Classic `java … -jar <file>` start.sh line --------------------------------

function parseJavaLine(line: string): ParsedScript {
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

function buildJavaLine(cfg: ParsedScript): string {
  const parts = ['java'];
  if (cfg.xms) parts.push(`-Xms${cfg.xms}`);
  if (cfg.xmx) parts.push(`-Xmx${cfg.xmx}`);
  if (cfg.extraFlags.trim()) parts.push(cfg.extraFlags.trim());
  if (cfg.jar) parts.push('-jar', cfg.jar, 'nogui');
  return parts.join(' ');
}

// --- Forge/NeoForge user_jvm_args.txt (one flag per line) ----------------------

interface ParsedArgsFile extends ParsedScript {
  comments: string[];
}

function parseArgsFile(content: string): ParsedArgsFile {
  const comments: string[] = [];
  let xms = '';
  let xmx = '';
  const extra: string[] = [];

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      comments.push(raw.replace(/\s+$/, ''));
      continue;
    }
    if (/^-Xms/i.test(line)) {
      xms = line.slice(4);
    } else if (/^-Xmx/i.test(line)) {
      xmx = line.slice(4);
    } else {
      extra.push(line);
    }
  }

  // One flag per line in the editor's textarea is easiest to read/edit.
  return { xms, xmx, jar: '', extraFlags: extra.join('\n'), comments };
}

function buildArgsFile(cfg: ParsedScript, comments: string[]): string {
  const lines: string[] = [...comments];
  if (comments.length) lines.push('');
  if (cfg.xms) lines.push(`-Xms${cfg.xms}`);
  if (cfg.xmx) lines.push(`-Xmx${cfg.xmx}`);
  for (const flag of cfg.extraFlags.split(/\s+/).filter(Boolean)) {
    lines.push(flag);
  }
  return lines.join('\n') + '\n';
}

function buildArgsPreview(cfg: ParsedScript): string {
  const parts = ['java'];
  if (cfg.xms) parts.push(`-Xms${cfg.xms}`);
  if (cfg.xmx) parts.push(`-Xmx${cfg.xmx}`);
  for (const flag of cfg.extraFlags.split(/\s+/).filter(Boolean)) parts.push(flag);
  parts.push('@user_jvm_args.txt', '@libraries/.../unix_args.txt', 'nogui');
  return parts.join(' ');
}

// -------------------------------------------------------------------------------

export class StartupScriptManager {
  /**
   * Forge/NeoForge servers launch JVM flags from user_jvm_args.txt (referenced as
   * @user_jvm_args.txt inside start.sh) and have no runnable `-jar`. When that file
   * exists we manage it directly; otherwise we fall back to the classic start.sh line.
   */
  async getMode(): Promise<StartupScriptConfig['mode']> {
    try {
      await fs.access(config.jvmArgsFile);
      return 'argfile';
    } catch {
      return 'script';
    }
  }

  async read(): Promise<StartupScriptConfig> {
    const mode = await this.getMode();

    if (mode === 'argfile') {
      let content = '';
      try {
        content = await fs.readFile(config.jvmArgsFile, 'utf-8');
      } catch {
        return { mode, xms: '', xmx: '', jar: '', extraFlags: '', rawCommand: '' };
      }
      const { comments, ...parsed } = parseArgsFile(content);
      void comments;
      return { mode, ...parsed, rawCommand: buildArgsPreview(parsed) };
    }

    let content = '';
    try {
      content = await fs.readFile(config.startScript, 'utf-8');
    } catch {
      return { mode, xms: '', xmx: '', jar: '', extraFlags: '', rawCommand: '' };
    }

    const javaLine = content.split('\n').find((l) => /\bjava\b/.test(l) && /-jar/.test(l));
    if (!javaLine) {
      return { mode, xms: '', xmx: '', jar: '', extraFlags: '', rawCommand: '' };
    }

    const parsed = parseJavaLine(javaLine.trim());
    return { mode, ...parsed, rawCommand: buildJavaLine(parsed) };
  }

  async write(cfg: StartupScriptInput): Promise<void> {
    const mode = await this.getMode();

    if (mode === 'argfile') {
      // Re-read the existing file to preserve its comment header on round-trip.
      let existing = '';
      try {
        existing = await fs.readFile(config.jvmArgsFile, 'utf-8');
      } catch {
        // No existing file — write with no preserved comments.
      }
      const { comments } = parseArgsFile(existing);
      await fs.writeFile(config.jvmArgsFile, buildArgsFile(cfg, comments), 'utf-8');
      return;
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

  async buildPreview(cfg: StartupScriptInput): Promise<string> {
    const mode = await this.getMode();
    return mode === 'argfile' ? buildArgsPreview(cfg) : buildJavaLine(cfg);
  }
}
