// Shared helpers for skillset scripts. Zero-dependency (node: builtins only).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export function parseFrontmatter(text) {
  const lines = String(text).split(/\r?\n/);
  if (!lines[0] || lines[0].trim() !== '---') return {};
  const map = {};
  let current = null;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const m = /^([A-Za-z][\w-]*):\s?(.*)$/.exec(line);
    if (m) {
      current = m[1];
      map[current] = m[2].trim();
    } else if (current && line.trim() !== '') {
      map[current] = map[current] ? `${map[current]} ${line.trim()}` : line.trim();
    }
  }
  return map;
}

export function readInstalledUserPlugins(pluginsFile) {
  const raw = JSON.parse(readFileSync(pluginsFile, 'utf8'));
  const out = [];
  for (const [key, entries] of Object.entries(raw.plugins ?? {})) {
    const entry = (Array.isArray(entries) ? entries : []).find((e) => e && e.scope === 'user');
    if (!entry) continue;
    const at = key.indexOf('@');
    out.push({
      key,
      name: at === -1 ? key : key.slice(0, at),
      marketplace: at === -1 ? '' : key.slice(at + 1),
      installPath: entry.installPath ?? '',
      version: entry.version ?? '',
    });
  }
  return out;
}

export function parseCliArgs(argv) {
  const flags = {};
  const positional = [];
  const needsValue = new Set(['data-dir', 'plugins-file', 'top']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const name = a.slice(2);
        if (needsValue.has(name) && i + 1 < argv.length) flags[name] = argv[++i];
        else flags[name] = true;
      }
    } else positional.push(a);
  }
  return { flags, positional };
}

export function defaultPaths() {
  return {
    dataDir: join(homedir(), '.claude', 'skillset', 'data'),
    pluginsFile: join(homedir(), '.claude', 'plugins', 'installed_plugins.json'),
  };
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, obj) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
}

export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}
