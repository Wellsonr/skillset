// Manifest generator + installer/updater. Never blocks workflow: per-plugin failures are reported, exit stays 0.
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
    return { error: 'manifest-missing', hint: 'jalankan: node sync.mjs --generate-manifest' };
  }
  const manifest = readJson(manifestFile);
  const installed = readInstalledUserPlugins(pluginsFile);
  const { missing, present } = diffManifest(manifest, installed);
  const result = { installed: [], updated: [], failed: [] };
  const run = (cmd) => {
    if (dryRun) { (result.dryRunCommands ??= []).push(cmd); return { status: 0, stdout: '', stderr: '' }; }
    return spawn(cmd);
  };
  for (const key of missing) {
    const r = run(buildInstallCmd(key));
    if (r.status === 0) result.installed.push(key);
    else result.failed.push({ key, error: (r.stderr || r.stdout || `exit ${r.status}`).trim() });
  }
  run(['claude', 'plugin', 'marketplace', 'update']);
  for (const key of [...present, ...result.installed]) {
    const r = run(buildUpdateCmd(key));
    if (r.status === 0) result.updated.push(key);
    else result.failed.push({ key, error: (r.stderr || r.stdout || `exit ${r.status}`).trim() });
  }
  return result;
}

export function main(argv) {
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
    ensureDir(dataDir);
    writeJson(manifestFile, generateManifest(readInstalledUserPlugins(pluginsFile)));
    console.log(JSON.stringify({ generated: true, file: manifestFile }));
    return 0;
  }

  if (!existsSync(manifestFile)) {
    console.error(JSON.stringify({ error: 'manifest-missing', hint: 'node sync.mjs --generate-manifest' }));
    return 2;
  }
  console.log(JSON.stringify(runSync({ manifestFile, pluginsFile, dryRun: Boolean(flags['dry-run']) })));
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('sync.mjs')) {
  process.exit(main(process.argv.slice(2)));
}
