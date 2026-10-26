// Manifest generator + installer/updater. Per-plugin & marketplace failures never abort the sync run (reported in failed[]). CLI exit 0 = sync phase complete; exit 2 = manifest or installed.json missing/unreadable/invalid, generate-manifest failure, or unexpected sync error (last resort).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { parseCliArgs, defaultPaths, readJson, writeJson, ensureDir, readInstalledUserPlugins } from './lib.mjs';

export function generateManifest(installed) {
  return { autoUpdate: true, plugins: installed.map((p) => p.key).sort() };
}

export function diffManifest(manifest, installed) {
  const have = new Set(installed.map((p) => p.key));
  const missing = [];
  const present = [];
  for (const key of manifest.plugins) (have.has(key) ? present : missing).push(key);
  return { missing, present };
}

export function buildInstallCmd(key) {
  return ['claude', 'plugin', 'install', key];
}

export function buildUpdateCmd(key) {
  return ['claude', 'plugin', 'update', key];
}

export function runSync({ manifestFile, pluginsFile, dryRun = false, spawn = spawnSync }) {
  if (!existsSync(manifestFile)) {
    return { error: 'manifest-missing', hint: 'run: node sync.mjs --generate-manifest' };
  }
  const manifest = readJson(manifestFile);
  const installed = readInstalledUserPlugins(pluginsFile);
  const { missing, present } = diffManifest(manifest, installed);
  const result = { installed: [], updated: [], failed: [] };
  const run = (cmd) => {
    if (dryRun) { (result.dryRunCommands ??= []).push(cmd); return { status: 0, stdout: '', stderr: '' }; }
    try {
      return spawn(cmd[0], cmd.slice(1), { encoding: 'utf8' });
    } catch (err) {
      return { status: -1, error: err };
    }
  };
  const errorText = (r) => {
    if (r.error) return String(r.error.message ?? r.error);
    const out = [r.stderr, r.stdout].map((s) => (s == null ? '' : String(s))).find((s) => s.trim());
    return out ? out.trim() : `exit ${r.status}${r.signal ? ` (${r.signal})` : ''}`;
  };
  for (const key of missing) {
    const r = run(buildInstallCmd(key));
    if (r.status === 0) result.installed.push(key);
    else result.failed.push({ key, error: errorText(r) });
  }
  const mr = run(['claude', 'plugin', 'marketplace', 'update']);
  if (mr.status !== 0) result.failed.push({ key: 'marketplace', error: errorText(mr) });
  for (const key of [...present, ...result.installed]) {
    const r = run(buildUpdateCmd(key));
    if (r.status === 0) result.updated.push(key);
    else result.failed.push({ key, error: errorText(r) });
  }
  return result;
}

export function main(argv, deps = {}) {
  const { flags } = parseCliArgs(argv);
  const defaults = defaultPaths();
  const dataDir = flags['data-dir'] || defaults.dataDir;
  const pluginsFile = flags['plugins-file'] || defaults.pluginsFile;
  const manifestFile = join(dataDir, 'manifest.json');

  if (flags['generate-manifest']) {
    if (existsSync(manifestFile) && !flags.force) {
      console.log(JSON.stringify({ manifestExists: true, file: manifestFile }));
      return 0;
    }
    if (!existsSync(pluginsFile)) {
      console.error(`plugins file not found: ${pluginsFile}`);
      return 2;
    }
    try {
      ensureDir(dataDir);
      writeJson(manifestFile, generateManifest(readInstalledUserPlugins(pluginsFile)));
    } catch (err) {
      console.error(`failed to generate manifest: ${err.message}`);
      return 2;
    }
    console.log(JSON.stringify({ generated: true, file: manifestFile }));
    return 0;
  }

  if (!existsSync(manifestFile)) {
    console.error(JSON.stringify({ error: 'manifest-missing', hint: 'node sync.mjs --generate-manifest' }));
    return 2;
  }
  try {
    readJson(manifestFile);
  } catch (err) {
    const label = err instanceof SyntaxError ? 'manifest.json is invalid' : 'manifest.json cannot be read';
    console.error(`${label}: ${err.message}`);
    return 2;
  }
  try {
    readInstalledUserPlugins(pluginsFile);
  } catch (err) {
    console.error(`${pluginsFile} cannot be read: ${err.message}`);
    return 2;
  }
  let result;
  try {
    result = runSync({ manifestFile, pluginsFile, dryRun: Boolean(flags['dry-run']), spawn: deps.spawn });
  } catch (err) {
    console.error(`sync failed: ${err.message}`);
    return 2;
  }
  console.log(JSON.stringify(result));
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('sync.mjs')) {
  process.exit(main(process.argv.slice(2)));
}
