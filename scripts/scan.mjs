// Scan installed user-scope plugins -> catalog.{json,md}; --check = cheap anti-stale drift check.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, readInstalledUserPlugins, parseCliArgs, defaultPaths, readJson, writeJson, ensureDir } from './lib.mjs';

function safeRead(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

function collectSkills(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({ dir: d.name, fm: parseFrontmatter(safeRead(join(root, d.name, 'SKILL.md'))) }))
    .filter((e) => Object.keys(e.fm).length > 0)
    .map((e) => ({ name: e.fm.name || e.dir, description: e.fm.description || '' }));
}

function collectMdFiles(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ file: f, fm: parseFrontmatter(safeRead(join(root, f))) }))
    .map((e) => ({ name: e.fm.name || e.file.replace(/\.md$/, ''), description: e.fm.description || '' }));
}

export function scanPlugins({ pluginsFile }) {
  const installed = readInstalledUserPlugins(pluginsFile);
  const plugins = [];
  const skipped = [];
  for (const p of installed) {
    if (!p.installPath || !existsSync(p.installPath)) { skipped.push(p.key); continue; }
    plugins.push({
      name: p.name,
      marketplace: p.marketplace,
      version: p.version,
      skills: collectSkills(join(p.installPath, 'skills')),
      commands: collectMdFiles(join(p.installPath, 'commands')),
      agents: collectMdFiles(join(p.installPath, 'agents')),
    });
  }
  return { generatedAt: new Date().toISOString(), plugins, skipped, duplicates: findDuplicates({ plugins }) };
}

function tokens(s) {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []);
}

function jaccard(a, b) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function findDuplicates(catalog, { threshold = 0.6 } = {}) {
  const duplicates = [];
  for (const [kind, label] of [['skills', 'skill'], ['commands', 'command'], ['agents', 'agent']]) {
    const items = [];
    for (const plugin of catalog.plugins) {
      for (const item of plugin[kind] || []) items.push({ plugin: plugin.name, item });
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const x = items[i];
        const y = items[j];
        if (x.plugin === y.plugin) continue;
        const sameName = x.item.name.toLowerCase() === y.item.name.toLowerCase();
        const similarity = jaccard(
          new Set(tokens(`${x.item.name} ${x.item.description}`)),
          new Set(tokens(`${y.item.name} ${y.item.description}`)),
        );
        if (similarity >= threshold || sameName) {
          const [a, b] = [`${x.plugin}:${x.item.name}`, `${y.plugin}:${y.item.name}`].sort();
          duplicates.push({ a, b, kind: label, similarity, sameName });
        }
      }
    }
  }
  return duplicates;
}

export function checkDrift(installed, catalog) {
  if (!catalog || !Array.isArray(catalog.plugins)) {
    return { fresh: false, changes: [{ type: 'missing-catalog' }] };
  }
  const cat = new Map(catalog.plugins.map((p) => [p.marketplace ? `${p.name}@${p.marketplace}` : p.name, p.version]));
  const inst = new Map(installed.map((p) => [p.key, p.version]));
  const changes = [];
  for (const [k, v] of inst) {
    if (!cat.has(k)) changes.push({ type: 'added', key: k, version: v });
    else if (cat.get(k) !== v) changes.push({ type: 'version', key: k, from: cat.get(k), to: v });
  }
  for (const k of cat.keys()) if (!inst.has(k)) changes.push({ type: 'removed', key: k });
  return { fresh: changes.length === 0, changes };
}

export function renderCatalogMd(catalog) {
  const lines = ['# Skillset Catalog', '', `Generated: ${catalog.generatedAt}`, ''];
  for (const p of catalog.plugins) {
    const src = p.marketplace ? `${p.marketplace}, ` : '';
    lines.push(`## ${p.name} (${src}${p.version || 'unknown'})`, '');
    for (const [kind, items] of [['skills', p.skills], ['commands', p.commands], ['agents', p.agents]]) {
      if (!items.length) continue;
      lines.push(`### ${kind}`, '');
      for (const it of items) lines.push(`- **${it.name}** — ${it.description || '(no description)'}`);
      lines.push('');
    }
  }
  if (catalog.duplicates?.length) {
    lines.push('## Duplicates', '', ...catalog.duplicates.map((d) =>
      `- ${d.a} ↔ ${d.b} (similarity ${d.similarity.toFixed(2)}${d.sameName ? ', sameName' : ''})`), '');
  }
  if (catalog.skipped?.length) {
    lines.push('## Skipped (installPath hilang)', '', ...catalog.skipped.map((k) => `- ${k}`), '');
  }
  return lines.join('\n');
}

export async function main(argv) {
  const { flags } = parseCliArgs(argv);
  const defaults = defaultPaths();
  const dataDir = flags['data-dir'] || defaults.dataDir;
  const pluginsFile = flags['plugins-file'] || defaults.pluginsFile;
  const catalogFile = join(dataDir, 'catalog.json');

  if (flags.check) {
    let installed;
    try {
      installed = readInstalledUserPlugins(pluginsFile);
    } catch (err) {
      console.error(`${pluginsFile} is invalid: ${err.message}`);
      return 2;
    }
    if (!existsSync(catalogFile)) {
      console.log(JSON.stringify({ fresh: false, changes: [{ type: 'missing-catalog' }] }));
      return 1;
    }
    let catalog;
    try {
      catalog = readJson(catalogFile);
    } catch (err) {
      console.error(`${catalogFile} is invalid: ${err.message}`);
      return 2;
    }
    const result = checkDrift(installed, catalog);
    console.log(JSON.stringify(result));
    return result.fresh ? 0 : 1;
  }

  let catalog;
  try {
    catalog = scanPlugins({ pluginsFile });
  } catch (err) {
    console.error(`${pluginsFile} is invalid: ${err.message}`);
    return 2;
  }
  ensureDir(dataDir);
  writeJson(catalogFile, catalog);
  writeFileSync(join(dataDir, 'catalog.md'), renderCatalogMd(catalog));
  const total = (k) => catalog.plugins.reduce((n, p) => n + p[k].length, 0);
  console.log(JSON.stringify({
    plugins: catalog.plugins.length,
    skills: total('skills'),
    commands: total('commands'),
    agents: total('agents'),
    skipped: catalog.skipped,
  }));
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('scan.mjs')) {
  process.exit(await main(process.argv.slice(2)));
}
