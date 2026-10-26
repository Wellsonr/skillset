// Benchmark: measures what a skillset routing step loads, from real files, and renders SVG charts.
// Token counts are estimates (bytes / 4); the ratios matter, not the absolute numbers.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCliArgs, defaultPaths, readJson, readInstalledUserPlugins } from './lib.mjs';
import { scoreEntries, formatResults } from './query.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_QUERIES = [['readme', 'docs', 'github'], ['react', 'vite', 'tailwind'], ['test', 'debug', 'refactor']];
const CHAINS = {
  small: ['superpowers:test-driven-development', 'superpowers:verification-before-completion', 'commit-commands:commit-push-pr'],
  medium: ['superpowers:brainstorming', 'superpowers:writing-plans', 'superpowers:test-driven-development',
    'mattpocock-skills:code-review', 'superpowers:verification-before-completion', 'commit-commands:commit-push-pr'],
  full: ['superpowers:brainstorming', 'mattpocock-skills:codebase-design', 'mattpocock-skills:domain-modeling',
    'superpowers:writing-plans', 'superpowers:test-driven-development', 'mattpocock-skills:code-review',
    'superpowers:verification-before-completion', 'superpowers:requesting-code-review',
    'superpowers:receiving-code-review', 'superpowers:finishing-a-development-branch', 'commit-commands:commit-push-pr'],
};

export const estimateTokens = (bytes) => Math.round(bytes / 4);
const fmt = (n) => n.toLocaleString('en-US');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function findSkillFile(root, name, depth = 7) {
  if (depth < 0 || !existsSync(root)) return null;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const p = join(root, entry.name);
    if (entry.isFile() && entry.name === `${name}.md` && root.endsWith('commands')) return p;
    if (entry.isDirectory()) {
      if (entry.name === name && existsSync(join(p, 'SKILL.md'))) return join(p, 'SKILL.md');
      const hit = findSkillFile(p, name, depth - 1);
      if (hit) return hit;
    }
  }
  return null;
}

export function renderBars({ title, subtitle = '', rows, unit = 'tokens' }) {
  const W = 760, left = 250, right = 110, rowH = 40, top = subtitle ? 74 : 56;
  const H = top + rows.length * rowH + 22;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const track = W - left - right;
  const bars = rows.map((r, i) => {
    const y = top + i * rowH;
    const w = Math.max((r.value / max) * track, 2);
    return `<text class="lbl" x="${left - 12}" y="${y + 18}" text-anchor="end">${esc(r.label)}</text>` +
      `<rect class="bar${r.accent ? ' accent' : ''}" x="${left}" y="${y + 3}" width="${w.toFixed(1)}" height="22" rx="4"/>` +
      `<text class="val" x="${(left + w + 8).toFixed(1)}" y="${y + 19}">${fmt(r.value)} ${unit}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(title)}">` +
    `<style>text{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif}.t{font-size:17px;font-weight:600;fill:#1f2328}.s{font-size:12px;fill:#59636e}` +
    `.lbl{font-size:13px;fill:#1f2328}.val{font-size:13px;font-weight:600;fill:#1f2328}.bar{fill:#9aa4b2}.accent{fill:#d97757}` +
    `@media (prefers-color-scheme: dark){.t,.lbl,.val{fill:#e6edf3}.s{fill:#9198a1}.bar{fill:#59636e}.accent{fill:#e8896a}}</style>` +
    `<text class="t" x="20" y="28">${esc(title)}</text>${subtitle ? `<text class="s" x="20" y="48">${esc(subtitle)}</text>` : ''}${bars}</svg>\n`;
}

export function measure({ dataDir, pluginsFile }) {
  const size = (f) => statSync(f).size;
  const catalogFile = join(dataDir, 'catalog.json');
  const catalog = readJson(catalogFile);
  const rulesFile = join(dataDir, 'rules.md');
  const queries = SAMPLE_QUERIES.map((kw) => {
    const rows = scoreEntries(catalog, kw);
    return { keywords: kw.join(' '),
      lean: Buffer.byteLength(formatResults(rows.slice(0, 5))),
      full: Buffer.byteLength(formatResults(rows.slice(0, 12), { full: true })) };
  });
  const avgLean = Math.round(queries.reduce((a, q) => a + q.lean, 0) / queries.length);
  const routing = { command: size(join(ROOT, 'commands/make.md')), router: size(join(ROOT, 'skills/router/SKILL.md')),
    query: avgLean, rules: existsSync(rulesFile) ? size(rulesFile) : 0 };
  const plugins = readInstalledUserPlugins(pluginsFile);
  const chains = {};
  for (const [kind, list] of Object.entries(CHAINS)) {
    let bytes = 0; const missing = [];
    for (const id of list) {
      const [pl, name] = id.split(':');
      const inst = plugins.find((p) => p.name === pl);
      const file = inst && findSkillFile(inst.installPath, name);
      if (file) bytes += size(file); else missing.push(id);
    }
    chains[kind] = { skills: list.length, bytes, missing };
  }
  return { catalogBytes: size(catalogFile), routing, routingBytes: Object.values(routing).reduce((a, b) => a + b, 0), queries, chains };
}

export function main(argv) {
  const { flags } = parseCliArgs(argv);
  const d = defaultPaths();
  const outDir = flags.out || join(ROOT, 'docs/assets');
  let m;
  try { m = measure({ dataDir: flags['data-dir'] || d.dataDir, pluginsFile: flags['plugins-file'] || d.pluginsFile }); }
  catch (err) { console.error(`bench failed: ${err.message} (run /skillset:init first)`); return 2; }
  const t = (b) => estimateTokens(b);
  const missing = Object.entries(m.chains).flatMap(([k, c]) => c.missing.map((s) => `${k}: ${s}`));
  if (missing.length) { console.error(`bench: skills not installed, chains would be understated:\n  ${missing.join('\n  ')}`); return 2; }
  mkdirSync(outDir, { recursive: true });
  const write = (name, svg) => writeFileSync(join(outDir, name), svg);
  write('bench-catalog.svg', renderBars({ title: 'What one routing step loads',
    subtitle: `Real files from this machine's catalog of ${fmt(m.catalogBytes)} bytes. Estimated tokens = bytes / 4.`,
    rows: [{ label: 'Full catalog (never loaded)', value: t(m.catalogBytes) },
      { label: 'Command + router + query + rules', value: t(m.routingBytes), accent: true }] }));
  write('bench-chain.svg', renderBars({ title: 'Skill text loaded by a chain',
    subtitle: 'Sum of the SKILL.md files each chain invokes. Task sizing picks the shortest chain that is safe.',
    rows: [{ label: `Large — full chain (${m.chains.full.skills} skills)`, value: t(m.chains.full.bytes) },
      { label: `Medium (${m.chains.medium.skills} skills)`, value: t(m.chains.medium.bytes) },
      { label: `Small (${m.chains.small.skills} skills)`, value: t(m.chains.small.bytes), accent: true }] }));
  write('bench-query.svg', renderBars({ title: 'Catalog query output: before vs after',
    subtitle: 'Three sample queries. Before = top 12 with full descriptions, after = top 5 with short ones.',
    rows: m.queries.flatMap((q, i) => [{ label: `Query ${i + 1} before`, value: t(q.full) },
      { label: `Query ${i + 1} after`, value: t(q.lean), accent: true }]) }));
  writeFileSync(join(outDir, 'bench.json'), JSON.stringify({ unit: 'bytes', estimatedTokens: 'bytes / 4', ...m }, null, 2) + '\n');
  const pct = (a, b) => Math.round((1 - a / b) * 100);
  console.log(JSON.stringify({
    routingTokens: t(m.routingBytes), catalogTokens: t(m.catalogBytes),
    chainTokens: Object.fromEntries(Object.entries(m.chains).map(([k, c]) => [k, t(c.bytes)])),
    smallVsFullSavedPct: pct(m.chains.small.bytes, m.chains.full.bytes),
    mediumVsFullSavedPct: pct(m.chains.medium.bytes, m.chains.full.bytes),
    queryTokens: m.queries.map((q) => ({ keywords: q.keywords, before: t(q.full), after: t(q.lean), savedPct: pct(q.lean, q.full) })),
    outDir }, null, 2));
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('bench.mjs')) process.exit(main(process.argv.slice(2)));
