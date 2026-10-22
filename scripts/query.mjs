// Keyword filter over catalog.json — the router's token-cheap view of the catalog.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseCliArgs, defaultPaths, readJson } from './lib.mjs';

export function scoreEntries(catalog, keywords) {
  const kws = keywords.map((k) => k.toLowerCase());
  const rows = [];
  for (const p of catalog.plugins ?? []) {
    for (const [kind, items] of [['skill', p.skills], ['command', p.commands], ['agent', p.agents]]) {
      for (const it of items ?? []) {
        const name = (it.name || '').toLowerCase();
        const desc = (it.description || '').toLowerCase();
        let score = 0;
        for (const kw of kws) {
          if (name === kw) score += 5;
          else if (name.includes(kw)) score += 3;
          if (desc.includes(kw)) score += 1;
        }
        if (score > 0) rows.push({ kind, plugin: p.name, name: it.name, description: it.description || '', score });
      }
    }
  }
  return rows.sort((a, b) => b.score - a.score);
}

export function formatResults(rows) {
  const out = [];
  for (const kind of ['skill', 'command', 'agent']) {
    const items = rows.filter((r) => r.kind === kind);
    if (!items.length) continue;
    out.push(`## ${kind}s`, '');
    for (const r of items) out.push(`- ${r.plugin}:${r.name} — ${r.description}`);
    out.push('');
  }
  return out.join('\n');
}

export function summarize(catalog) {
  return (catalog.plugins ?? []).map((p) =>
    `${p.name} (${p.marketplace || 'local'}, ${p.version || '?'}) — ` +
    `${(p.skills ?? []).length} skills, ${(p.commands ?? []).length} commands, ${(p.agents ?? []).length} agents`
  ).join('\n');
}

export function main(argv) {
  const { flags, positional } = parseCliArgs(argv);
  const defaults = defaultPaths();
  const dataDir = flags['data-dir'] || defaults.dataDir;
  const catalogFile = join(dataDir, 'catalog.json');
  if (!existsSync(catalogFile)) {
    console.error('Katalog belum ada. Jalankan /skillset:init (atau: node scripts/scan.mjs).');
    return 2;
  }
  let catalog;
  try {
    catalog = readJson(catalogFile);
  } catch (err) {
    console.error(`${catalogFile} tidak valid: ${err.message}`);
    return 2;
  }
  if (flags.summary) {
    console.log(summarize(catalog));
    return 0;
  }
  const top = Number(flags.top || 12);
  const rows = scoreEntries(catalog, positional).slice(0, top);
  if (flags.json) console.log(JSON.stringify(rows, null, 2));
  else console.log(rows.length ? formatResults(rows) : 'Tidak ada hasil untuk keyword tersebut.');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('query.mjs')) {
  process.exit(main(process.argv.slice(2)));
}
