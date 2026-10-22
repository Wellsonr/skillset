# Plugin Skillset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun plugin Claude Code `skillset` — router satu pintu untuk skill semua plugin user-scope: katalog otomatis, auto-install + auto-update, 9 command (init/update/make/development/plan/execute/review/rules/catalog), rules custom workflow-only.

**Architecture:** Pendekatan A (spec §2 D5): katalog persisten digenerate oleh script scan dari `installed_plugins.json`, router = command markdown tipis + prosedur bersama di `skills/router/SKILL.md`, data runtime di `~/.claude/skillset/data/` (di luar repo).

**Tech Stack:** Node ≥18 ESM `.mjs` zero-dependency (hanya `node:` builtins; mesin ini v23.7.0), test via `node --test`, plugin manifest `.claude-plugin/plugin.json` + marketplace lokal `.claude-plugin/marketplace.json` (schema terkonfirmasi dari plugin cockroachdb).

**Spec:** `docs/superpowers/specs/2026-10-22-skillset-plugin-design.md` — plan berargumen dari spec; executor membaca keduanya.

## Global Constraints

- Zero-dependency: hanya modul `node:` (`fs`, `path`, `os`, `child_process`; test: `node:test`, `node:assert/strict`).
- Semua script harus bisa diarahkan ke fixture via flag: `--data-dir <dir>` (default `~/.claude/skillset/data`) dan `--plugins-file <file>` (default `~/.claude/plugins/installed_plugins.json`). Unit test WAJIB memakai flag ini, tidak menyentuh home asli.
- Nama plugin `skillset`; marketplace lokal bernama `skillset-local` dengan `"source": "./"`.
- Semua referensi file plugin dari command memakai `${CLAUDE_PLUGIN_ROOT}`.
- Isi command/SKILL.md/template/rules: bahasa Indonesia. Identifier, nama fungsi, komentar kode: English.
- Kontrak exit code: `scan.mjs --check` exit 0 = segar, 1 = drift/katalog hilang. `sync.mjs` selalu exit 0 kecuali manifest hilang (exit 2) — kegagalan per-plugin dilaporkan di output, TIDAK memblok workflow (spec §7).
- Data runtime (`manifest.json`, `rules.md`, `catalog.json`, `catalog.md`) TIDAK pernah di-commit ke repo.
- Satu commit per task, pesan conventional commit (`feat:`, `test:`, `docs:`).
- Direktori kerja semua perintah: `/config/workspace/ai/skillset` (repo root polyrepo `/config/workspace`; JANGAN `git add` file di luar project ini).

## Review Focus

Lima kelas input/failure yang paling mungkin menggigit, beserta test yang memangkunya di task pemiliknya:

1. **Frontmatter multi-baris & karakter aneh** (deskripsi panjang lintas baris, `"quotes"`, `—` em-dash) → parser harus menggabungkan baris lanjutan, bukan berhenti di baris pertama. → Test Task 2 (`parses multi-line description with quotes and em-dash`).
2. **Key duplikat scope di `installed_plugins.json`** (superpowers tercatat 6× dengan scope `local`, hanya 1× `user`) → reader harus mengambil hanya entri scope `user`, tanpa duplikat skill di katalog. → Test Task 2 (`picks only user-scope entry per key`).
3. **Key tanpa `@marketplace`** (plugin skills-dir seperti `foo` polos) → tidak boleh crash; marketplace = string kosong; key dipakai apa adanya. → Test Task 2 (`handles key without @marketplace`).
4. **`installPath` tercatat tapi hilang di disk** (cache terhapus) → scan melewati dengan daftar `skipped`, tidak crash. → Test Task 3 (`skips plugin whose installPath is missing`).
5. **`catalog.json` hilang/korup saat `--check` atau `query`** → pesan jelas + exit code benar (check: 1; query: pesan arahkan `/skillset:init`, exit 2), bukan stack trace. → Test Task 3 (`check fails cleanly when catalog missing`) & Task 5 (`query exits 2 with guidance when catalog missing`).

---

### Task 1: Scaffold plugin + marketplace lokal + validasi

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `README.md` (stub; dilengkapi Task 9)

**Interfaces:**
- Consumes: — (task pertama)
- Produces: plugin `skillset` valid menurut `claude plugin validate`; marketplace `skillset-local` yang menjadikan repo ini installable via `claude plugin marketplace add /config/workspace/ai/skillset` → `claude plugin install skillset@skillset-local` (dipakai Task 9).

- [ ] **Step 1: Buat `.claude-plugin/plugin.json`**

```json
{
  "name": "skillset",
  "version": "0.1.0",
  "description": "Router satu pintu untuk skill semua plugin user-scope: katalog otomatis, auto-install + auto-update, workflow berbasis intensi (make/development/plan/execute/review) dengan rules custom.",
  "author": { "name": "Wellson" },
  "keywords": ["skills", "routing", "orchestration", "catalog"]
}
```

- [ ] **Step 2: Buat `.claude-plugin/marketplace.json`** (schema mengikuti contoh cockroachdb: marketplace di repo yang sama dengan plugin, `source: "./"`)

```json
{
  "name": "skillset-local",
  "owner": { "name": "Wellson" },
  "metadata": {
    "description": "Marketplace lokal untuk plugin skillset",
    "version": "0.1.0"
  },
  "plugins": [
    {
      "name": "skillset",
      "description": "Router skill lintas plugin dengan katalog otomatis, auto-install/update, dan rules custom workflow-only.",
      "source": "./"
    }
  ]
}
```

- [ ] **Step 3: Buat `README.md` stub**

```markdown
# skillset

Plugin Claude Code: router satu pintu untuk skill semua plugin user-scope.
Status: dalam pengembangan — lihat `docs/superpowers/specs/2026-10-22-skillset-plugin-design.md`.
```

- [ ] **Step 4: Validasi**

Run: `claude plugin validate /config/workspace/ai/skillset`
Expected: lulus tanpa error (exit 0). Bila error struktur, perbaiki sesuai pesan sebelum lanjut.

- [ ] **Step 5: Commit**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json README.md
git commit -m "feat(skillset): scaffold plugin manifest + marketplace lokal"
```

---

### Task 2: `scripts/lib.mjs` — parser frontmatter + reader installed plugins + CLI args

**Files:**
- Create: `scripts/lib.mjs`
- Test: `tests/lib.test.mjs`

**Interfaces:**
- Consumes: —
- Produces (dipakai Task 3–5):
  - `parseFrontmatter(text: string): Object` — map key→value; nilai multi-baris digabung dengan spasi.
  - `readInstalledUserPlugins(pluginsFile: string): Array<{key, name, marketplace, installPath, version}>` — hanya entri scope `user`, satu per key.
  - `parseCliArgs(argv: string[]): {flags: Object, positional: string[]}` — mendukung `--flag`, `--flag value`, `--flag=value` (untuk `data-dir`, `plugins-file`, `top`).
  - `defaultPaths(): {dataDir, pluginsFile}` — dari `os.homedir()`.
  - `readJson(file)`, `writeJson(file, obj)` (indent 2 + trailing newline), `ensureDir(dir)`.

- [ ] **Step 1: Tulis failing test `tests/lib.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, readInstalledUserPlugins, parseCliArgs } from '../scripts/lib.mjs';

test('parses simple frontmatter', () => {
  const md = '---\nname: demo\ndescription: short desc\n---\nbody';
  assert.deepEqual(parseFrontmatter(md), { name: 'demo', description: 'short desc' });
});

test('parses multi-line description with quotes and em-dash', () => {
  const md = '---\nname: demo\ndescription: Use when building things\n  that need "quotes" and — dashes\n---\n';
  const fm = parseFrontmatter(md);
  assert.equal(fm.name, 'demo');
  assert.equal(fm.description, 'Use when building things that need "quotes" and — dashes');
});

test('returns empty object when no frontmatter', () => {
  assert.deepEqual(parseFrontmatter('# plain'), {});
});

test('picks only user-scope entry per key', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-lib-'));
  const f = join(dir, 'installed_plugins.json');
  writeFileSync(f, JSON.stringify({ version: 2, plugins: {
    'superpowers@claude-plugins-official': [
      { scope: 'local', installPath: '/nope/local', version: '6.1.1' },
      { scope: 'user', installPath: '/cache/superpowers/6.4.1', version: '6.4.1' },
    ],
  }}));
  const list = readInstalledUserPlugins(f);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], {
    key: 'superpowers@claude-plugins-official',
    name: 'superpowers',
    marketplace: 'claude-plugins-official',
    installPath: '/cache/superpowers/6.4.1',
    version: '6.4.1',
  });
  rmSync(dir, { recursive: true, force: true });
});

test('handles key without @marketplace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-lib-'));
  const f = join(dir, 'installed_plugins.json');
  writeFileSync(f, JSON.stringify({ plugins: {
    'my-skills-dir-plugin': [{ scope: 'user', installPath: '/x', version: '1.0.0' }],
  }}));
  const [p] = readInstalledUserPlugins(f);
  assert.equal(p.name, 'my-skills-dir-plugin');
  assert.equal(p.marketplace, '');
  rmSync(dir, { recursive: true, force: true });
});

test('parseCliArgs supports space, equals, and numeric flags', () => {
  const { flags, positional } = parseCliArgs([
    'keyword1', '--check', '--data-dir', '/tmp/d', '--top=20', 'keyword2',
  ]);
  assert.equal(flags.check, true);
  assert.equal(flags['data-dir'], '/tmp/d');
  assert.equal(flags.top, '20');
  assert.deepEqual(positional, ['keyword1', 'keyword2']);
});
```

- [ ] **Step 2: Jalankan test, pastikan FAIL**

Run: `node --test tests/lib.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/lib.mjs'`.

- [ ] **Step 3: Implementasi `scripts/lib.mjs`** (bentuk final yang bersih — semua import di atas)

```js
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
```

- [ ] **Step 4: Jalankan test, pastikan PASS**

Run: `node --test tests/lib.test.mjs`
Expected: 6 test PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib.mjs tests/lib.test.mjs
git commit -m "feat(skillset): lib — frontmatter parser, installed-plugins reader, cli args"
```

---

### Task 3: `scripts/scan.mjs` — generator katalog + anti-stale `--check`

**Files:**
- Create: `scripts/scan.mjs`
- Create: `tests/fixtures/installed.json` + `tests/fixtures/demo-plugin/` (dipakai juga Task 9)
- Test: `tests/scan.test.mjs`

**Interfaces:**
- Consumes: `parseFrontmatter`, `readInstalledUserPlugins`, `parseCliArgs`, `defaultPaths`, `readJson`, `writeJson`, `ensureDir` dari `scripts/lib.mjs`.
- Produces (dipakai command Task 7–8, router Task 6, query Task 5):
  - `scanPlugins({ pluginsFile }): {generatedAt, plugins: Array, skipped: string[]}` — plugin = `{name, marketplace, version, skills: [{name, description}], commands: [...], agents: [...]}`.
  - `checkDrift(installed, catalog): {fresh: boolean, changes: Array}`.
  - `renderCatalogMd(catalog): string`.
  - CLI: `node scan.mjs [--data-dir D] [--plugins-file F]` menulis `catalog.json` + `catalog.md`, print ringkasan JSON; `node scan.mjs --check [...]` print `{"fresh":...,"changes":[...]}`, exit 0 segar / 1 drift-atau-katalog-hilang.

- [ ] **Step 1: Tulis failing test `tests/scan.test.mjs`** (fixture dibangun lokal per test via `makeFixture()`)

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanPlugins, checkDrift, renderCatalogMd, main } from '../scripts/scan.mjs';

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-scan-'));
  const dataDir = join(dir, 'data');
  const pluginsFile = join(dir, 'installed_plugins.json');
  const pluginRoot = join(dir, 'plugins', 'demo-plugin');
  mkdirSync(join(pluginRoot, 'skills', 'alpha'), { recursive: true });
  mkdirSync(join(pluginRoot, 'skills', 'beta'), { recursive: true });
  mkdirSync(join(pluginRoot, 'commands'), { recursive: true });
  mkdirSync(join(pluginRoot, 'agents'), { recursive: true });
  writeFileSync(join(pluginRoot, 'skills', 'alpha', 'SKILL.md'),
    '---\nname: alpha\ndescription: One-line skill\n---\n');
  writeFileSync(join(pluginRoot, 'skills', 'beta', 'SKILL.md'),
    '---\nname: beta\ndescription: Long description spanning\n  two lines with "quotes"\n---\n');
  writeFileSync(join(pluginRoot, 'commands', 'go.md'),
    '---\ndescription: Run the go command\n---\n');
  writeFileSync(join(pluginRoot, 'agents', 'helper.md'),
    '---\nname: helper\ndescription: Helps\n---\n');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'demo-plugin@demo-market': [{ scope: 'user', installPath: pluginRoot, version: '1.2.3' }],
    'ghost-plugin@demo-market': [{ scope: 'user', installPath: join(dir, 'missing'), version: '0.0.1' }],
  }}));
  return { dir, dataDir, pluginsFile };
}

test('scanPlugins catalogs skills, commands, agents; joins multi-line descriptions', () => {
  const { pluginsFile, dir } = makeFixture();
  const catalog = scanPlugins({ pluginsFile });
  assert.deepEqual(catalog.skipped, ['ghost-plugin@demo-market']);
  const demo = catalog.plugins.find((p) => p.name === 'demo-plugin');
  assert.equal(demo.version, '1.2.3');
  assert.deepEqual(demo.skills.map((s) => s.name), ['alpha', 'beta']);
  assert.equal(demo.skills[1].description, 'Long description spanning two lines with "quotes"');
  assert.equal(demo.commands[0].name, 'go');
  assert.equal(demo.agents[0].name, 'helper');
  rmSync(dir, { recursive: true, force: true });
});

test('checkDrift detects version change, addition, removal, and freshness', () => {
  const installed = [
    { key: 'a@m', version: '2.0.0' },
    { key: 'b@m', version: '1.0.0' },
  ];
  const stale = { plugins: [
    { name: 'a', marketplace: 'm', version: '1.0.0' },
    { name: 'c', marketplace: 'm', version: '1.0.0' },
  ]};
  const r = checkDrift(installed, stale);
  assert.equal(r.fresh, false);
  const types = r.changes.map((c) => `${c.type}:${c.key}`).sort();
  assert.deepEqual(types, ['added:b@m', 'removed:c@m', 'version:a@m']);
  const freshCatalog = { plugins: [
    { name: 'a', marketplace: 'm', version: '2.0.0' },
    { name: 'b', marketplace: 'm', version: '1.0.0' },
  ]};
  assert.equal(checkDrift(installed, freshCatalog).fresh, true);
});

test('check fails cleanly when catalog missing', () => {
  const r = checkDrift([{ key: 'a@m', version: '1' }], null);
  assert.equal(r.fresh, false);
  assert.deepEqual(r.changes, [{ type: 'missing-catalog' }]);
});

test('renderCatalogMd includes plugin header and one-line entries', () => {
  const { pluginsFile, dir } = makeFixture();
  const md = renderCatalogMd(scanPlugins({ pluginsFile }));
  assert.match(md, /## demo-plugin \(demo-market, 1\.2\.3\)/);
  assert.match(md, /\*\*alpha\*\* — One-line skill/);
  rmSync(dir, { recursive: true, force: true });
});

test('CLI --check exits 1 when catalog is missing', async () => {
  const { dataDir, pluginsFile, dir } = makeFixture();
  const code = await main(['--check', '--data-dir', dataDir, '--plugins-file', pluginsFile]);
  assert.equal(code, 1);
  rmSync(dir, { recursive: true, force: true });
});

test('CLI scan writes catalog.json and catalog.md', async () => {
  const { dataDir, pluginsFile, dir } = makeFixture();
  const code = await main(['--data-dir', dataDir, '--plugins-file', pluginsFile]);
  assert.equal(code, 0);
  const catalog = JSON.parse(readFileSync(join(dataDir, 'catalog.json'), 'utf8'));
  assert.equal(catalog.plugins.length, 1);
  assert.ok(existsSync(join(dataDir, 'catalog.md')));
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Jalankan test, pastikan FAIL**

Run: `node --test tests/scan.test.mjs`
Expected: FAIL — module `../scripts/scan.mjs` tidak ditemukan.

- [ ] **Step 3: Implementasi `scripts/scan.mjs`** (bentuk final bersih)

```js
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
  return { generatedAt: new Date().toISOString(), plugins, skipped };
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
    let result;
    try {
      result = checkDrift(readInstalledUserPlugins(pluginsFile), readJson(catalogFile));
    } catch {
      result = { fresh: false, changes: [{ type: 'missing-catalog' }] };
    }
    console.log(JSON.stringify(result));
    return result.fresh ? 0 : 1;
  }

  const catalog = scanPlugins({ pluginsFile });
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
```

- [ ] **Step 4: Jalankan test, pastikan PASS**

Run: `node --test tests/scan.test.mjs`
Expected: 6 test PASS.

- [ ] **Step 5: Buat fixture statis untuk smoke CLI** — `tests/fixtures/demo-plugin/skills/alpha/SKILL.md` (frontmatter `name: alpha`, `description: Fixture skill for smoke test`) dan `tests/fixtures/installed.json`:

```json
{
  "plugins": {
    "demo-plugin@demo-market": [
      { "scope": "user", "installPath": "REPLACE_ABS_PATH/tests/fixtures/demo-plugin", "version": "1.2.3" }
    ]
  }
}
```

Ganti `REPLACE_ABS_PATH` dengan path absolut aktual (`/config/workspace/ai/skillset`).

Lalu smoke: `node scripts/scan.mjs --data-dir /tmp/skillset-smoke --plugins-file tests/fixtures/installed.json` → JSON ringkasan + `/tmp/skillset-smoke/catalog.{json,md}` ada; `node scripts/scan.mjs --check ...` → exit 0; ubah versi di fixture jadi `9.9.9` → exit 1; kembalikan ke `1.2.3`.

- [ ] **Step 6: Commit**

```bash
git add scripts/scan.mjs tests/scan.test.mjs tests/fixtures/
git commit -m "feat(skillset): scan — katalog plugin terpasang + drift check --check"
```

---

### Task 4: `scripts/sync.mjs` — generate manifest + install/update

**Files:**
- Create: `scripts/sync.mjs`
- Test: `tests/sync.test.mjs`

**Interfaces:**
- Consumes: `readInstalledUserPlugins`, `parseCliArgs`, `defaultPaths`, `readJson`, `writeJson`, `ensureDir` dari lib.
- Produces (dipakai command init/update Task 7):
  - `generateManifest(installed): {autoUpdate: true, plugins: string[]}` — key terurut.
  - `diffManifest(manifest, installed): {missing: string[], present: string[]}`.
  - `buildInstallCmd(key): string[]` → `['claude','plugin','install',key]`.
  - `buildUpdateCmd(key): string[]` → `['claude','plugin','update',key]`.
  - `runSync({manifestFile, pluginsFile, dryRun, spawn}): {installed: [], updated: [], failed: [{key, error}], dryRunCommands?: [][]}` — `spawn` injectable (default `spawnSync`), signature `(cmdArray) => {status, stdout, stderr}`.
  - CLI: `--generate-manifest` (tidak menimpa kecuali `--force`); default mode install-missing + `claude plugin marketplace update` + update-all; exit 0 selalu kecuali manifest hilang → exit 2.

- [ ] **Step 1: Tulis failing test `tests/sync.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateManifest, diffManifest, buildInstallCmd, buildUpdateCmd, runSync } from '../scripts/sync.mjs';
import { writeJson } from '../scripts/lib.mjs';

const installed = [
  { key: 'b@m2', installPath: '/x', version: '1' },
  { key: 'a@m1', installPath: '/y', version: '2' },
];

test('generateManifest sorts keys with autoUpdate true', () => {
  assert.deepEqual(generateManifest(installed), { autoUpdate: true, plugins: ['a@m1', 'b@m2'] });
});

test('diffManifest splits missing vs present', () => {
  const d = diffManifest({ autoUpdate: true, plugins: ['a@m1', 'c@m3'] }, installed);
  assert.deepEqual(d.missing, ['c@m3']);
  assert.deepEqual(d.present, ['a@m1']);
});

test('buildInstallCmd and buildUpdateCmd shapes', () => {
  assert.deepEqual(buildInstallCmd('c@m3'), ['claude', 'plugin', 'install', 'c@m3']);
  assert.deepEqual(buildUpdateCmd('a@m1'), ['claude', 'plugin', 'update', 'a@m1']);
});

test('runSync dry-run builds commands without spawning', () => {
  let spawned = 0;
  const spawn = () => { spawned++; return { status: 0, stdout: '', stderr: '' }; };
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1', 'c@m3'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const result = runSync({ manifestFile, pluginsFile, dryRun: true, spawn });
  assert.equal(spawned, 0);
  assert.deepEqual(result.dryRunCommands, [
    ['claude', 'plugin', 'install', 'c@m3'],
    ['claude', 'plugin', 'marketplace', 'update'],
    ['claude', 'plugin', 'update', 'a@m1'],
    ['claude', 'plugin', 'update', 'c@m3'],
  ]);
  rmSync(dir, { recursive: true, force: true });
});

test('runSync reports per-plugin failure without throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-sync-'));
  const manifestFile = join(dir, 'manifest.json');
  writeJson(manifestFile, { autoUpdate: true, plugins: ['a@m1'] });
  const pluginsFile = join(dir, 'installed.json');
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {
    'a@m1': [{ scope: 'user', installPath: '/y', version: '2' }],
  }}));
  const spawn = (cmd) => cmd[1] === 'plugin' && cmd[2] === 'update'
    ? { status: 1, stdout: '', stderr: 'network down' }
    : { status: 0, stdout: '', stderr: '' };
  const result = runSync({ manifestFile, pluginsFile, dryRun: false, spawn });
  assert.deepEqual(result.failed, [{ key: 'a@m1', error: 'network down' }]);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Jalankan test, pastikan FAIL**

Run: `node --test tests/sync.test.mjs`
Expected: FAIL — module tidak ditemukan.

- [ ] **Step 3: Implementasi `scripts/sync.mjs`**

```js
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
```

- [ ] **Step 4: Jalankan test, pastikan PASS + regresi**

Run: `node --test tests/*.test.mjs`
Expected: semua PASS (lib 6 + scan 6 + sync 5).

- [ ] **Step 5: Commit**

```bash
git add scripts/sync.mjs tests/sync.test.mjs
git commit -m "feat(skillset): sync — generate manifest, install missing, update all (non-blocking)"
```

---

### Task 5: `scripts/query.mjs` — filter katalog per keyword

**Files:**
- Create: `scripts/query.mjs`
- Test: `tests/query.test.mjs`

**Interfaces:**
- Consumes: `parseCliArgs`, `defaultPaths`, `readJson` dari lib; bentuk `catalog.json` dari Task 3.
- Produces (dipakai router Task 6 & command catalog Task 7):
  - `scoreEntries(catalog, keywords): Array<{kind, plugin, name, description, score}>` — skor: name===kw +5, name includes kw +3, description includes kw +1 (case-insensitive, akumulasi antar keyword); skor 0 dibuang; terurut desc.
  - `formatResults(rows): string` — `plugin:name — description` dikelompokkan per kind.
  - `summarize(catalog): string` — per plugin: `name (marketplace, version) — N skills, N commands, N agents`.
  - CLI: `node query.mjs <kw...> [--data-dir D] [--top N (12)] [--json] [--summary]`; katalog hilang → stderr pesan arahkan `/skillset:init`, exit 2.

- [ ] **Step 1: Tulis failing test `tests/query.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreEntries, formatResults, summarize } from '../scripts/query.mjs';

const catalog = { generatedAt: '2026-10-22T00:00:00.000Z', plugins: [
  { name: 'superpowers', marketplace: 'off', version: '6.4.1',
    skills: [
      { name: 'brainstorming', description: 'Turn ideas into designs' },
      { name: 'tdd', description: 'Test driven development workflow' },
    ],
    commands: [], agents: [] },
  { name: 'mattpocock-skills', marketplace: 'off', version: '1.0.0',
    skills: [{ name: 'tdd', description: 'Write tests first' }],
    commands: [], agents: [] },
]};

test('scores by exact/substring name and description', () => {
  const rows = scoreEntries(catalog, ['tdd']);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].score >= 3);
});

test('formatResults groups by kind with plugin prefix', () => {
  const out = formatResults(scoreEntries(catalog, ['tdd']));
  assert.match(out, /superpowers:tdd — Test driven development workflow/);
  assert.match(out, /mattpocock-skills:tdd — Write tests first/);
});

test('drops zero-score entries', () => {
  const rows = scoreEntries(catalog, ['nonexistent-keyword']);
  assert.equal(rows.length, 0);
});

test('summarize lists per-plugin counts', () => {
  assert.match(summarize(catalog), /superpowers \(off, 6\.4\.1\) — 2 skills, 0 commands, 0 agents/);
});
```

- [ ] **Step 2: Jalankan test, pastikan FAIL**

Run: `node --test tests/query.test.mjs`
Expected: FAIL — module tidak ditemukan.

- [ ] **Step 3: Implementasi `scripts/query.mjs`**

```js
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
  const catalog = readJson(catalogFile);
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
```

- [ ] **Step 4: Jalankan test + guard katalog hilang**

Run: `node --test tests/query.test.mjs && node scripts/query.mjs tdd --data-dir /tmp/does-not-exist-skillset; echo "exit=$?"`
Expected: 4 test PASS; perintah kedua mencetak "Katalog belum ada…" dan `exit=2`.

- [ ] **Step 5: Commit**

```bash
git add scripts/query.mjs tests/query.test.mjs
git commit -m "feat(skillset): query — keyword filter katalog untuk routing hemat token"
```

---

### Task 6: `skills/router/SKILL.md` + `templates/rules.template.md`

**Files:**
- Create: `skills/router/SKILL.md`
- Create: `templates/rules.template.md`

**Interfaces:**
- Consumes: CLI contract Task 3 (`scan.mjs --check`) dan Task 5 (`query.mjs <kw>`); path data `~/.claude/skillset/data/`.
- Produces: prosedur routing yang dibaca kelima command router (Task 8) via instruksi Read `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md`; template rules yang disalin `/skillset:init` (Task 7).

- [ ] **Step 1: Tulis `skills/router/SKILL.md`** (isi persis berikut)

````markdown
---
name: router
description: Prosedur routing bersama semua command router skillset (make/development/plan/execute/review) — pre-flight anti-stale, pemilihan rantai skill lintas plugin, usulan-konfirmasi, eksekusi berantai, penerapan rules.
---

# Prosedur Router Skillset

Command pemanggil memberikan: **archetype** (tabel rantai titik-awal) dan **task**. Ikuti langkah:

1. **Pre-flight anti-stale.** Jalankan `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs" --check`.
   - Exit 1 dengan `missing-catalog` → tawarkan menjalankan `/skillset:init` dulu; jangan lanjut sebelum user memilih.
   - Exit 1 dengan drift (`added`/`version`/`removed`) → tawarkan `/skillset:update`; user boleh menolak dan lanjut dengan katalog lama.
2. **Deteksi task trivial.** Bila task bukan proyek/workflow (pertanyaan kecil, permintaan satu baris), sampaikan bahwa rantai skill tidak diperlukan, jawab langsung, selesai.
3. **Load selektif.** Jalankan `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" <keyword domain task>` (WAJIB lewat query — JANGAN membaca `catalog.json`/`catalog.md` penuh). Lalu `Read ~/.claude/skillset/data/rules.md`; bila belum ada → tawarkan `/skillset:init`.
4. **Susun rantai.** Mulai dari archetype command, sesuaikan dengan hasil query (hanya skill yang benar-benar tersedia di katalog). Substitusi dua arah bila skill tak tersedia:
   - `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
   - `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`
   - review utama: `mattpocock-skills:code-review` ⇄ `pr-review-toolkit:review-pr`

   Skill tanpa substitusi → usulkan skip dengan catatan.
5. **Tentukan rules aktif.** Section `selalu` selalu aktif; section lain (mis. `web-project`) aktif bila triggernya cocok task. Sebutkan rules yang akan diterapkan.
6. **USULKAN → tunggu konfirmasi eksplisit.** Tampilkan tabel: skill → peran → alasan; rules aktif; file yang akan dibaca. JANGAN eksekusi apa pun sebelum user menyetujui (atau mengubah lalu menyetujui).
7. **Eksekusi berantai.** Invoke skill via Skill tool sesuai urutan. Sebelum tiap fase, cek rules yang relevan fase tersebut. Hormati gate internal tiap skill (mis. approval brainstorming TIDAK di-bypass).
8. **Ringkasan akhir.** Hasil per fase, status penerapan rules (mis. docs mana yang di-update), saran follow-up (`/skillset:review`, `/skillset:update`, dst.).
````

- [ ] **Step 2: Tulis `templates/rules.template.md`** (isi persis berikut)

````markdown
# Skillset Rules

Rules di bawah hanya berlaku dalam workflow command skillset (`/skillset:make|development|plan|execute|review`), tidak pada sesi Claude Code biasa. Section `selalu` aktif di semua workflow; section lain aktif bila triggernya cocok dengan task. Edit file ini langsung, atau lewat `/skillset:rules`.

## selalu
- Setiap ada progress (fase selesai / milestone) → update dokumentasi terkait di docs/

## init
- Baca CLAUDE.md + docs/ project dulu sebelum mulai workflow

## web-project
<!-- trigger: task membangun web frontend baru -->
- Wajib sertakan service-worker (PWA-ready)
- Form login: dukung navigasi Tab + submit via Enter
````

- [ ] **Step 3: Validasi struktur**

Run: `claude plugin validate /config/workspace/ai/skillset`
Expected: lulus (skills/ kini terdeteksi).

- [ ] **Step 4: Commit**

```bash
git add skills/router/SKILL.md templates/rules.template.md
git commit -m "feat(skillset): router skill — prosedur routing bersama + template rules"
```

---

### Task 7: Commands non-router — `init`, `update`, `rules`, `catalog`

**Files:**
- Create: `commands/init.md`
- Create: `commands/update.md`
- Create: `commands/rules.md`
- Create: `commands/catalog.md`

**Interfaces:**
- Consumes: CLI Task 3–5; template Task 6.
- Produces: `/skillset:init`, `/skillset:update`, `/skillset:rules`, `/skillset:catalog` (tersedia setelah install; dismoke Task 9).

- [ ] **Step 1: Tulis `commands/init.md`** (isi persis berikut)

````markdown
---
description: Bootstrap skillset — generate manifest, install + update semua plugin manifest ke latest, generate katalog, siapkan rules.
allowed-tools: Bash
---

Jalankan langkah berikut lewat Bash satu per satu, sampaikan output penting apa adanya, lalu ringkas. Jangan menambah diagnosis sendiri kecuali diminta.

1. `mkdir -p ~/.claude/skillset/data`
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs" --generate-manifest` (aman: tidak menimpa manifest yang sudah ada)
3. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs"`
4. `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs"`
5. Bila `~/.claude/skillset/data/rules.md` belum ada: `cp "${CLAUDE_PLUGIN_ROOT}/templates/rules.template.md" ~/.claude/skillset/data/rules.md`

Ringkasan wajib: plugin baru ter-install, plugin ter-update, plugin gagal (+error), jumlah skill/command/agent di katalog, skipped, lokasi `manifest.json` & `rules.md`. Ingatkan user: restart sesi Claude Code bila ada plugin yang baru di-install/update agar versi baru aktif.
````

- [ ] **Step 2: Tulis `commands/update.md`**

````markdown
---
description: Update semua plugin manifest ke latest + regenerate katalog skillset.
allowed-tools: Bash
---

Jalankan lewat Bash, sampaikan output penting apa adanya, lalu ringkas:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs"`
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs"`

Ringkasan wajib: ter-update, gagal (+error), jumlah entri katalog baru, skipped. Ingatkan: restart sesi bila ada plugin ter-update agar versi baru aktif.
````

- [ ] **Step 3: Tulis `commands/rules.md`**

````markdown
---
description: Lihat / tambah / edit rules custom skillset (~/.claude/skillset/data/rules.md).
allowed-tools: Read, Edit, Write, Bash
---

File rules: `~/.claude/skillset/data/rules.md`. Bila belum ada, salin dari `"${CLAUDE_PLUGIN_ROOT}/templates/rules.template.md"` dulu (Bash `cp`).

1. Baca dan tampilkan isi rules saat ini.
2. Tanyakan aksi user: lihat / tambah / ubah / hapus rule (atau user menyebutkan scope & isi langsung).
3. Saat menulis: pertahankan format — section `## <scope>` dengan bullet `- <aturan>`; scope `selalu` aktif di semua workflow; scope lain aktif bila triggernya cocok task; komentar `<!-- trigger: ... -->` opsional di bawah header untuk menjelaskan kapan scope aktif.
4. Tampilkan hasil akhir file dan konfirmasikan.
````

- [ ] **Step 4: Tulis `commands/catalog.md`**

````markdown
---
description: Browse katalog skill semua plugin user-scope (ringkasan per plugin atau cari keyword).
allowed-tools: Bash
---

Argumen `$ARGUMENTS` = keyword opsional.

- Bila ADA keyword: `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" $ARGUMENTS` lalu tampilkan hasilnya apa adanya.
- Bila KOSONG: `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" --summary` lalu tampilkan ringkasan per plugin.

Bila output menyatakan katalog belum ada: sarankan `/skillset:init`. Jangan meringkas isi katalog dengan asumsi sendiri — tampilkan hasil script.
````

- [ ] **Step 5: Validasi + commit**

Run: `claude plugin validate /config/workspace/ai/skillset` → lulus.

```bash
git add commands/init.md commands/update.md commands/rules.md commands/catalog.md
git commit -m "feat(skillset): commands non-router — init, update, rules, catalog"
```

---

### Task 8: Commands router — `make`, `development`, `plan`, `execute`, `review`

**Files:**
- Create: `commands/make.md`
- Create: `commands/development.md`
- Create: `commands/plan.md`
- Create: `commands/execute.md`
- Create: `commands/review.md`

**Interfaces:**
- Consumes: `skills/router/SKILL.md` (Task 6), dibaca via tool Read pada `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md`.
- Produces: lima command router sesuai archetype spec §6.2 (D7).

- [ ] **Step 1: Tulis `commands/make.md`**

````markdown
---
description: Router — bangun sesuatu dari ide jadi kode bekerja (usulkan rantai skill lintas plugin → konfirmasi → eksekusi).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

Task user: $ARGUMENTS

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read, lalu ikuti prosedur router di sana dengan:

- **Archetype make** (rantai titik-awal, sesuaikan per task lewat hasil query):
  1. `superpowers:brainstorming` — klasifikasi & desain
  2. `mattpocock-skills:codebase-design` + `mattpocock-skills:domain-modeling` — bila struktur/domain signifikan
  3. `superpowers:writing-plans` — implementation plan
  4. `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  5. `mattpocock-skills:code-review`
  6. `superpowers:verification-before-completion`
````

- [ ] **Step 2: Tulis `commands/development.md`**

````markdown
---
description: Router — full lifecycle dari ide sampai release (plan → implement → test → review → PR → deploy).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

Task user: $ARGUMENTS

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read, lalu ikuti prosedur router di sana dengan:

- **Archetype development** (rantai titik-awal, sesuaikan per task lewat hasil query):
  1. `superpowers:brainstorming` — klasifikasi & desain
  2. `mattpocock-skills:codebase-design` + `mattpocock-skills:domain-modeling` — bila struktur/domain signifikan
  3. `superpowers:writing-plans`
  4. `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  5. `mattpocock-skills:code-review`
  6. `superpowers:verification-before-completion`
  7. `superpowers:requesting-code-review` → `superpowers:receiving-code-review`
  8. `superpowers:finishing-a-development-branch`
  9. `commit-commands:commit-push-pr`
  10. Deploy sesuai stack terdeteksi dari query: `vercel:deploy` / `cloudflare:wrangler` / `ecc:pm2` / pola docker (`docker:build:prod`)
````

- [ ] **Step 3: Tulis `commands/plan.md`**

````markdown
---
description: Router — produksi implementation plan saja (riset → desain → plan; tanpa implementasi).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

Task user: $ARGUMENTS

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read, lalu ikuti prosedur router di sana dengan:

- **Archetype plan** (deliverable = dokumen plan, BERHENTI di plan — jangan implementasi):
  1. `mattpocock-skills:research` — bila perlu riset lib/pola
  2. `superpowers:brainstorming` — bila belum ada spec/disain (sampai spec disetujui user)
  3. `superpowers:writing-plans`
````

- [ ] **Step 4: Tulis `commands/execute.md`**

````markdown
---
description: Router — eksekusi implementation plan yang sudah ada (pilih mode eksekusi sesuai ukuran plan).
argument-hint: "[path-ke-plan.md]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

Plan user: $ARGUMENTS

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read, lalu ikuti prosedur router di sana dengan:

- **Archetype execute** (baca plan di path tersebut dulu, laporkan jumlah task-nya):
  1. Deteksi ukuran: plan kecil (≤ ~8 task) → `superpowers:executing-plans`; plan besar/paralelisabel → `superpowers:subagent-driven-development`
  2. Selama implementasi: `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  3. Review antar-task (bila subagent-driven): `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`
  4. Penutup: `superpowers:verification-before-completion` + laporan hasil per task
````

- [ ] **Step 5: Tulis `commands/review.md`**

````markdown
---
description: Router — review perubahan yang baru dikerjakan di sesi ini (diff uncommitted, atau commit terakhir bila tree bersih).
allowed-tools: Bash, Read, Skill, Agent, AskUserQuestion
---

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read. Untuk review, tahap analisis/load diganti:

1. **Deteksi scope** lewat Bash: `git status --short`; bila kosong → `git log -5 --oneline` dan tanyakan commit mana yang direview.
2. **Review utama**: `mattpocock-skills:code-review`; bila ada PR aktif → `pr-review-toolkit:review-pr`.
3. **Reviewer per-bahasa** sesuai ekstensi file di diff (agent): `ecc:typescript-reviewer`, `ecc:go-reviewer`, `ecc:php-reviewer`, `ecc:python-reviewer`, dll. — pilih hanya yang relevan.
4. **Opsional** (usulkan bila relevan, user menyetujui): `ecc:pr-test-analyzer` (cakupan test), `security-auditor` (diff menyentuh auth/payment/env/secrets).
5. Tetap jalankan pre-flight anti-stale, rules, dan usulan→konfirmasi sesuai prosedur router. Output akhir: findings terurut severity + rekomendasi fix.
````

- [ ] **Step 6: Validasi + commit**

Run: `claude plugin validate /config/workspace/ai/skillset` → lulus.

```bash
git add commands/make.md commands/development.md commands/plan.md commands/execute.md commands/review.md
git commit -m "feat(skillset): commands router — make, development, plan, execute, review"
```

---

### Task 9: Docs akhir + smoke test install lokal end-to-end

**Files:**
- Modify: `README.md` (stub → lengkap)
- Create: `docs/manual-verification.md`

**Interfaces:**
- Consumes: semua task sebelumnya; `tests/fixtures/` dari Task 3.
- Produces: plugin ter-install di mesin ini (marketplace lokal) + bukti verifikasi end-to-end.

- [ ] **Step 1: Ganti isi `README.md` menjadi lengkap**

```markdown
# skillset

Plugin Claude Code: router satu pintu untuk skill semua plugin user-scope.

## Install (marketplace lokal)

    claude plugin marketplace add /config/workspace/ai/skillset
    claude plugin install skillset@skillset-local

Restart sesi Claude Code setelah install/update.

## Commands

| Command | Fungsi |
|---|---|
| `/skillset:init` | Bootstrap: manifest (semua plugin user-scope) → install yang kurang → update semua → generate katalog + rules awal |
| `/skillset:update` | Update semua plugin manifest ke latest + regenerate katalog |
| `/skillset:make <task>` | Router: ide → kode bekerja |
| `/skillset:development <task>` | Router: full lifecycle sampai release |
| `/skillset:plan <task>` | Router: produksi implementation plan |
| `/skillset:execute <plan>` | Router: eksekusi plan existing |
| `/skillset:review` | Router: review perubahan sesi terbaru |
| `/skillset:rules` | Kelola rules custom (workflow-only) |
| `/skillset:catalog` | Browse katalog skill |

## Data

Runtime (bukan bagian repo): `~/.claude/skillset/data/` — `manifest.json`, `rules.md`, `catalog.json`, `catalog.md`.

## Development

    node --test tests/*.test.mjs   # unit test semua script
    claude plugin validate /config/workspace/ai/skillset

Spec: `docs/superpowers/specs/2026-10-22-skillset-plugin-design.md` · Plan: `docs/superpowers/plans/2026-10-22-skillset-plugin.md`
```

- [ ] **Step 2: Tulis `docs/manual-verification.md`**

```markdown
# Manual Verification — skillset v0.1.0

Lakukan setelah install (restart sesi). Centang bila lulus.

## Unit & struktur
- [ ] `node --test tests/*.test.mjs` → semua PASS (lib, scan, sync, query)
- [ ] `claude plugin validate /config/workspace/ai/skillset` → lulus
- [ ] `node scripts/scan.mjs --check --data-dir /tmp/skillset-smoke --plugins-file tests/fixtures/installed.json` → exit 0; ubah versi fixture → exit 1

## /skillset:init (end-to-end, menyentuh home asli — memang tujuan plugin)
- [ ] `/skillset:init` → manifest tergenerate berisi plugin user-scope saat ini; `~/.claude/skillset/data/catalog.md` ada dan memuat superpowers dkk.
- [ ] Plugin gagal update (bila ada) dilaporkan, workflow tetap selesai
- [ ] `rules.md` terbentuk dari template; jalankan ulang `/skillset:init` → rules TIDAK tertimpa

## /skillset:catalog & query
- [ ] `/skillset:catalog` → ringkasan per plugin
- [ ] `/skillset:catalog tdd` → hasil query ber-prefix plugin

## Router
- [ ] `/skillset:make tambah tombol export CSV di dashboard` → pre-flight jalan; usulan rantai tampil (brainstorming…verification); TIDAK eksekusi apa pun sebelum konfirmasi
- [ ] Task trivial (pertanyaan kecil nyata) → router menjawab langsung tanpa rantai

## Drift
- [ ] Jalankan `claude plugin update superpowers`, lalu `node scripts/scan.mjs --check` → exit 1 (drift terdeteksi)

## Clean-up fixture
- [ ] `rm -rf /tmp/skillset-smoke`
```

- [ ] **Step 3: Smoke test install lokal** — konfirmasi user dulu (mengubah config user Claude Code):

```
claude plugin marketplace add /config/workspace/ai/skillset
claude plugin install skillset@skillset-local
```

Restart sesi Claude Code → jalankan `/skillset:init` → ikuti `docs/manual-verification.md`, centang hasilnya.

- [ ] **Step 4: Commit final**

```bash
git add README.md docs/manual-verification.md
git commit -m "docs(skillset): README lengkap + manual verification end-to-end"
```

---

## Self-Review (hasil pemeriksaan penulis plan)

1. **Spec coverage:** D1 → Task 6 (SKILL.md langkah 5 + template pembatasan workflow-only); D2 → langkah 6 usulan-konfirmasi; D3 → Task 4 `generateManifest` dari user-scope + init langkah 2; D4 → `runSync` update-all + `marketplace update`; D5 → Task 3 katalog + `--check` dipakai router langkah 1; D6 → Task 7–8 (9 command); D7 → Task 8 archetype persis spec §6.2; D8 → `defaultPaths` home + README "Data". Spec §7 → sync non-blocking (Task 4), substitusi/trivial/missing-catalog (Task 6), query exit 2 (Task 5). Spec §8 → unit tests Tasks 2–5, validate berulang, manual-verification (Task 9). ✓
2. **Placeholder scan:** tidak ada TBD/"implement later"/"similar to Task N"; semua langkah berisi kode atau konten file penuh. ✓
3. **Type consistency:** nama fungsi lib (Task 2) konsisten di Task 3–5; `scanPlugins/checkDrift/renderCatalogMd/main` konsisten test↔impl; `runSync` return-shape (`installed/updated/failed/dryRunCommands`) konsensi test↔impl; `scoreEntries/formatResults/summarize` konsisten. ✓
4. **Review Focus:** kelima baris terpenuhi test-nya di task pemilik (Task 2: 3 test; Task 3: skipped + missing-catalog; Task 5: exit 2). ✓
