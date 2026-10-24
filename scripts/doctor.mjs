// Consistency audit (report-only): catalog age, drift, manifest, rules, duplicates, src-version. Exit 0 = all ok, 1 = any warn/fail, 2 = data file invalid/unreadable.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { checkDrift } from './scan.mjs';
import { diffManifest } from './sync.mjs';
import { readJson, readInstalledUserPlugins, parseCliArgs, defaultPaths } from './lib.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

export function doctorChecks({ catalog, installed, manifest, hasRules, srcVersion = null, installedVersion = null, now = new Date() }) {
  const checks = [];

  if (catalog == null) {
    checks.push({ id: 'catalog', status: 'fail', detail: 'catalog.json tidak ada — jalankan /skillset:init' });
  } else {
    const ageDays = (now.getTime() - Date.parse(catalog.generatedAt)) / DAY_MS;
    if (ageDays > 7) {
      checks.push({ id: 'catalog', status: 'warn', detail: `catalog berumur ${Math.floor(ageDays)} hari — jalankan /skillset:scan` });
    } else {
      checks.push({ id: 'catalog', status: 'ok', detail: 'catalog segar' });
    }
  }

  if (catalog != null) {
    const { fresh, changes } = checkDrift(installed, catalog);
    if (!fresh) {
      checks.push({ id: 'drift', status: 'warn', detail: `${changes.length} perubahan — jalankan /skillset:update` });
    } else {
      checks.push({ id: 'drift', status: 'ok', detail: 'catalog sesuai instalasi' });
    }
  }

  if (manifest == null) {
    checks.push({ id: 'manifest', status: 'warn', detail: 'manifest.json tidak ada — node sync.mjs --generate-manifest' });
  } else {
    const { missing } = diffManifest(manifest, installed);
    if (missing.length > 0) {
      checks.push({ id: 'manifest', status: 'warn', detail: `${missing.length} plugin di manifest belum terpasang` });
    } else {
      checks.push({ id: 'manifest', status: 'ok', detail: 'manifest sesuai instalasi' });
    }
  }

  if (!hasRules) {
    checks.push({ id: 'rules', status: 'warn', detail: 'rules.md tidak ada — jalankan /skillset:init' });
  } else {
    checks.push({ id: 'rules', status: 'ok', detail: 'rules.md ada' });
  }

  const dupCount = catalog?.duplicates?.length ?? 0;
  if (dupCount > 0) {
    checks.push({ id: 'duplicates', status: 'warn', detail: `${dupCount} pasangan duplikat (lihat catalog.md)` });
  } else {
    checks.push({ id: 'duplicates', status: 'ok', detail: 'tidak ada duplikat' });
  }

  if (srcVersion && installedVersion) {
    if (srcVersion !== installedVersion) {
      checks.push({ id: 'skillset-src', status: 'warn', detail: `source v${srcVersion} ≠ terpasang v${installedVersion} — bump versi & publish, atau reinstall` });
    } else {
      checks.push({ id: 'skillset-src', status: 'ok', detail: `source v${srcVersion} = terpasang v${installedVersion}` });
    }
  } else {
    checks.push({ id: 'skillset-src', status: 'ok', detail: 'versi source tidak diperiksa' });
  }

  return checks;
}

export async function main(argv) {
  const { flags, positional } = parseCliArgs(argv);
  const defaults = defaultPaths();
  const dataDir = flags['data-dir'] || defaults.dataDir;
  const pluginsFile = flags['plugins-file'] || defaults.pluginsFile;
  const catalogFile = join(dataDir, 'catalog.json');
  const manifestFile = join(dataDir, 'manifest.json');

  let catalog = null;
  if (existsSync(catalogFile)) {
    try {
      catalog = readJson(catalogFile);
    } catch (err) {
      console.error(`${catalogFile} tidak valid: ${err.message}`);
      return 2;
    }
  }

  let installed;
  try {
    installed = readInstalledUserPlugins(pluginsFile);
  } catch (err) {
    console.error(`${pluginsFile} tidak valid: ${err.message}`);
    return 2;
  }

  let manifest = null;
  if (existsSync(manifestFile)) {
    try {
      manifest = readJson(manifestFile);
    } catch (err) {
      console.error(`${manifestFile} tidak valid: ${err.message}`);
      return 2;
    }
  }

  const hasRules = existsSync(join(dataDir, 'rules.md'));

  let srcDir = flags['skillset-src'];
  if (srcDir === true) srcDir = positional.shift(); // parseCliArgs only knows value-flags data-dir/plugins-file/top; the space-form value lands in positional.
  let srcVersion = null;
  if (typeof srcDir === 'string' && srcDir) {
    try {
      srcVersion = readJson(join(srcDir, '.claude-plugin', 'plugin.json')).version ?? null;
    } catch {
      srcVersion = null;
    }
  }
  const skillsetEntry = installed.find((p) => p.key.startsWith('skillset@'));
  const installedVersion = skillsetEntry ? skillsetEntry.version : null;

  const checks = doctorChecks({ catalog, installed, manifest, hasRules, srcVersion, installedVersion });
  if (flags.json) {
    console.log(JSON.stringify(checks));
  } else {
    for (const c of checks) console.log(`[${c.status}] ${c.id} — ${c.detail}`);
  }
  return checks.some((c) => c.status !== 'ok') ? 1 : 0;
}

if (process.argv[1] && process.argv[1].endsWith('doctor.mjs')) {
  process.exit(await main(process.argv.slice(2)));
}
