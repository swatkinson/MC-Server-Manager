import * as fs from 'fs/promises';
import * as path from 'path';
import type { ModConfigFile, ModConfigRoot, ModConfigVersion } from '../types/index.js';

// Text formats mods actually ship configs in. Anything else (binary caches,
// .dat, images) is hidden from the editor.
const EDITABLE_EXTENSIONS = new Set([
  '.toml', '.json', '.json5', '.cfg', '.conf', '.txt', '.properties', '.ini',
  '.yml', '.yaml', '.snbt', '.omniconf', '.csv', '.js', '.zs', '.mcmeta', '.xml',
]);
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 5_000;
const VERSIONS_PER_FILE = 10;

interface RootDef {
  id: string;
  label: string;
  description: string;
  resolve: () => Promise<string>;
}

export class ModConfigService {
  private readonly roots: RootDef[];

  constructor(
    minecraftDir: string,
    getWorldPath: () => Promise<string>,
    private readonly historyDir: string,
  ) {
    this.roots = [
      {
        id: 'config',
        label: 'config/',
        description: 'Mod configs shared by every world. Forge reloads most .toml files live; others apply on restart.',
        resolve: async () => path.join(minecraftDir, 'config'),
      },
      {
        id: 'serverconfig',
        label: 'world/serverconfig/',
        description: 'Per-world server configs. These override defaultconfigs/ for the current world.',
        resolve: async () => path.join(await getWorldPath(), 'serverconfig'),
      },
      {
        id: 'defaultconfigs',
        label: 'defaultconfigs/',
        description: 'Templates copied into a world\'s serverconfig/ when a new world is generated.',
        resolve: async () => path.join(minecraftDir, 'defaultconfigs'),
      },
    ];
  }

  async listRoots(): Promise<ModConfigRoot[]> {
    return Promise.all(
      this.roots.map(async (root) => {
        const dir = await root.resolve();
        const files = await walk(dir);
        return { id: root.id, label: root.label, description: root.description, files };
      }),
    );
  }

  async read(rootId: string, relPath: string): Promise<{ content: string; mtimeMs: number; size: number }> {
    const file = await this.resolveFile(rootId, relPath);
    const stat = await fs.stat(file);
    if (stat.size > MAX_FILE_BYTES) throw new ConfigError(413, 'File is too large to edit here');
    return { content: await fs.readFile(file, 'utf-8'), mtimeMs: stat.mtimeMs, size: stat.size };
  }

  // Writes are guarded by the mtime the editor loaded: if the file changed on
  // disk since (a mod rewrote it, another admin saved), the save is refused
  // rather than silently clobbering it.
  async write(rootId: string, relPath: string, content: string, expectedMtimeMs: number): Promise<{ mtimeMs: number }> {
    if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_BYTES) throw new ConfigError(413, 'Content is too large');
    const file = await this.resolveFile(rootId, relPath);
    const stat = await fs.stat(file);
    if (Math.abs(stat.mtimeMs - expectedMtimeMs) > 1) {
      throw new ConfigError(409, 'This file changed on disk since you opened it. Reload it to see the latest version.');
    }

    const previous = await fs.readFile(file, 'utf-8');
    if (previous === content) return { mtimeMs: stat.mtimeMs };
    await this.saveVersion(rootId, relPath, previous);

    // Written in place (not temp + rename): Forge's config watcher reacts to
    // modify events on the existing file, which is what triggers a live reload.
    await fs.writeFile(file, content, 'utf-8');
    return { mtimeMs: (await fs.stat(file)).mtimeMs };
  }

  async listVersions(rootId: string, relPath: string): Promise<ModConfigVersion[]> {
    await this.resolveFile(rootId, relPath);
    const dir = this.versionDir(rootId, relPath);
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }
    const versions = await Promise.all(
      names.filter((n) => /^\d+\.bak$/.test(n)).map(async (id) => {
        const stat = await fs.stat(path.join(dir, id));
        return { id, savedAt: parseInt(id, 10), size: stat.size };
      }),
    );
    return versions.sort((a, b) => b.savedAt - a.savedAt);
  }

  async readVersion(rootId: string, relPath: string, versionId: string): Promise<string> {
    if (!/^\d+\.bak$/.test(versionId)) throw new ConfigError(400, 'Invalid version');
    await this.resolveFile(rootId, relPath);
    return fs.readFile(path.join(this.versionDir(rootId, relPath), versionId), 'utf-8');
  }

  private async saveVersion(rootId: string, relPath: string, content: string): Promise<void> {
    const dir = this.versionDir(rootId, relPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${Date.now()}.bak`), content, 'utf-8');
    const names = (await fs.readdir(dir)).filter((n) => n.endsWith('.bak')).sort().reverse();
    await Promise.all(names.slice(VERSIONS_PER_FILE).map((n) => fs.rm(path.join(dir, n), { force: true })));
  }

  private versionDir(rootId: string, relPath: string): string {
    return path.join(this.historyDir, rootId, relPath);
  }

  // Resolves a root-relative path and proves it stays inside the root after
  // following symlinks — the editor must never reach outside the config dirs.
  private async resolveFile(rootId: string, relPath: string): Promise<string> {
    const root = this.roots.find((r) => r.id === rootId);
    if (!root) throw new ConfigError(404, 'Unknown config root');
    if (typeof relPath !== 'string' || !relPath || relPath.includes('\0') || path.isAbsolute(relPath)) {
      throw new ConfigError(400, 'Invalid path');
    }
    if (!EDITABLE_EXTENSIONS.has(path.extname(relPath).toLowerCase())) {
      throw new ConfigError(400, 'This file type cannot be edited here');
    }
    const rootDir = await fs.realpath(await root.resolve()).catch(() => {
      throw new ConfigError(404, 'Config folder not found');
    });
    const target = await fs.realpath(path.join(rootDir, relPath)).catch(() => {
      throw new ConfigError(404, 'File not found');
    });
    if (!target.startsWith(rootDir + path.sep)) throw new ConfigError(400, 'Invalid path');
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw new ConfigError(400, 'Not a file');
    return target;
  }
}

export class ConfigError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function walk(rootDir: string): Promise<ModConfigFile[]> {
  const out: ModConfigFile[] = [];
  const visit = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= MAX_FILES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
      } else if (entry.isFile() && EDITABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const stat = await fs.stat(full).catch(() => null);
        if (!stat || stat.size > MAX_FILE_BYTES) continue;
        out.push({ path: path.relative(rootDir, full).split(path.sep).join('/'), size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  };
  await visit(rootDir);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
