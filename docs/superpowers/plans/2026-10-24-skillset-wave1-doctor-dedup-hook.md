# Skillset Wave 1 (doctor + dedup + hook) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wave 1 plugin skillset — `/skillset:doctor` (audit konsistensi), deteksi skill duplikat lintas-plugin di `scan.mjs`, hook SessionStart warn-only.

**Architecture:** Tiga tambahan mandadi di atas pola existing: pure function di `scan.mjs` (+ duplikat masuk katalog), script baru `doctor.mjs` yang mengonsumsi helper existing, dan hook read-only yang memanggil logika cek yang sama dengan `scan --check`.

**Tech Stack:** Node ESM `.mjs`, zero-dependency (node: builtins), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-24-skillset-waves-roadmap.md`

## Global Constraints

- Zero-dependency: hanya import `node:` builtins.
- Pola script: exported pure functions + `main(argv)` tipis + guard `if (process.argv[1] && process.argv[1].endsWith('<file>'))`.
- Exit contract: `0` sehat / `1` ada temuan / `2` input malformed.
- Doctor & hook **read-only**; hook SELALU exit 0 dan diam saat fresh.
- Pesan konsol script bahasa Indonesia (ikuti `scan.mjs`/`sync.mjs`); header `catalog.md` English.
- Full suite: `node --test tests/*.test.mjs` (bentuk glob; bentuk direktori gagal di Node 23.7.0). Semua test existing (38) wajib tetap hijau.
- One commit per task, conventional commits (`feat(skillset)/docs(skillset)/chore(skillset)`), bahasa Indonesia seperti history repo.

## Review Focus

1. **Malformed JSON** di `catalog.json`/`installed_plugins.json`/`manifest.json` → doctor exit 2 dengan pesan (bukan stack trace); hook diam exit 0. → Task 2 & Task 3.
2. **Katalog kosong / deskripsi kosong** → `findDuplicates` mengembalikan `[]` tanpa error. → Task 1.
3. **Beda kapital/spasi** ("Review Code" vs "review  code!") → tetap terdeteksi duplikat (normalisasi token). → Task 1.
4. **`generatedAt` di masa depan** (clock skew) → dianggap ok, bukan warn/usia negatif. → Task 2.
5. **`installed_plugins.json` rusak saat sesi mulai** → hook diam, exit 0, sesi tetap jalan. → Task 3.

---

### Task 1: `findDuplicates` + duplikat di katalog

**Files:**
- Modify: `scripts/scan.mjs`
- Test: `tests/scan.test.mjs`

**Interfaces:**
- Consumes: `scanPlugins`, `renderCatalogMd` existing.
- Produces: `findDuplicates(catalog, { threshold = 0.6 } = {})` → array `{ a, b, kind, similarity, sameName }` dengan `a`/`b` berformat `"<plugin>:<item>"` (urut pasangan alfabetis); `scanPlugins()` return menambah field `duplicates` (array, bisa `[]`); `renderCatalogMd` merender section `## Duplicates` (baris `- a ↔ b (similarity 0.82)`) hanya bila ada duplikat.

- [ ] **Step 1: Write the failing tests** di `tests/scan.test.mjs` (import `findDuplicates`):

```js
test('findDuplicates: same normalized name across plugins flagged; same-plugin ignored', () => {
  const catalog = { plugins: [
    { name: 'a', marketplace: 'm1', skills: [{ name: 'Review', description: 'Review code changes' }], commands: [], agents: [] },
    { name: 'b', marketplace: 'm2', skills: [{ name: 'review', description: 'Totally different domain stuff' }], commands: [], agents: [] },
  ]};
  const d = findDuplicates(catalog);
  assert.equal(d.length, 1);
  assert.equal(d[0].sameName, true);
  assert.deepEqual([d[0].a, d[0].b].sort(), ['a:Review', 'b:review']);
});

test('findDuplicates: jaccard >= threshold flagged, dissimilar not, empty catalog -> []', () => {
  const catalog = { plugins: [
    { name: 'a', marketplace: 'm1', skills: [{ name: 'tdd', description: 'test driven development write tests first' }], commands: [], agents: [] },
    { name: 'b', marketplace: 'm2', skills: [{ name: 'tdd-guide', description: 'test driven development write the test first always' }], commands: [], agents: [] },
    { name: 'c', marketplace: 'm3', skills: [{ name: 'paint', description: 'mix colors on canvas' }], commands: [], agents: [] },
  ]};
  const d = findDuplicates(catalog, { threshold: 0.6 });
  assert.equal(d.length, 1);
  assert.deepEqual([d[0].a, d[0].b].sort(), ['a:tdd', 'b:tdd-guide']);
  assert.equal(d[0].sameName, false);
  assert.deepEqual(findDuplicates({ plugins: [] }), []);
  assert.deepEqual(findDuplicates({ plugins: [{ name: 'x', skills: [{ name: 's', description: '' }], commands: [], agents: [] }] }), []);
});

test('scanPlugins includes duplicates field; renderCatalogMd renders Duplicates section', () => {
  const { pluginsFile, dir } = makeFixture();
  const catalog = scanPlugins({ pluginsFile });
  assert.deepEqual(catalog.duplicates, []);
  const withDup = { ...catalog, duplicates: [{ a: 'a:tdd', b: 'b:tdd-guide', kind: 'skill', similarity: 0.6, sameName: false }] };
  const md = renderCatalogMd(withDup);
  assert.match(md, /## Duplicates/);
  assert.match(md, /a:tdd ↔ b:tdd-guide/);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests, verify FAIL** — `node --test tests/scan.test.mjs` → FAIL (`findDuplicates is not a function`).

- [ ] **Step 3: Implement** di `scripts/scan.mjs`:
  - `export function findDuplicates(catalog, { threshold = 0.6 } = {})`: tokenisasi `tokens(s) = (s.toLowerCase().match(/[a-z0-9]+/g) || [])`; similarity = Jaccard `|∩|/|∪|` atas token gabungan `name + ' ' + description` (set kosong × set kosong → similarity 0); bandingkan pasangan item **sesama kind** (`skills`, `commands`, `agents`) **lintas plugin**; flag bila `similarity >= threshold || sameName` (`sameName` = nama lowercase identik); setiap pasangan dilaporkan sekali dengan `a`/`b` diurut alfabetis.
  - `scanPlugins`: hasil akhir menambah `duplicates: findDuplicates({ plugins })`.
  - `renderCatalogMd`: bila `catalog.duplicates?.length`, push section `## Duplicates` + baris `` - `a` ↔ `b` (similarity N, sameName?) ``.

- [ ] **Step 4: Run full suite** — `node --test tests/*.test.mjs` → all PASS (38 existing + 3 baru).

- [ ] **Step 5: Commit** — `git add scripts/scan.mjs tests/scan.test.mjs && git commit -m "feat(skillset): deteksi duplikat skill lintas-plugin di katalog"`

### Task 2: `doctor.mjs` — audit konsistensi (report-only)

**Files:**
- Create: `scripts/doctor.mjs`
- Test: `tests/doctor.test.mjs`

**Interfaces:**
- Consumes: `checkDrift(installed, catalog)` (scan.mjs), `diffManifest(manifest, installed)` (sync.mjs), `readJson/readInstalledUserPlugins/parseCliArgs/defaultPaths` (lib.mjs), `catalog.duplicates` (Task 1).
- Produces: `doctorChecks({ catalog, installed, manifest, hasRules, srcVersion = null, installedVersion = null, now = new Date() })` → array `{ id, status: 'ok'|'warn'|'fail', detail }`; `main(argv)` → exit 0/1/2; flags: `--data-dir`, `--plugins-file`, `--skillset-src <dir>`, `--json`.

Semantik check (id → logika):
- `catalog`: `catalog == null` → **fail** "catalog.json tidak ada — jalankan /skillset:init"; else umur = `now - Date.parse(generatedAt)`; umur > 7 hari → **warn**; umur negatif (future) → ok.
- `drift`: skip bila catalog null; `checkDrift` → `!fresh` → **warn** "N perubahan — jalankan /skillset:update".
- `manifest`: `manifest == null` → **warn** "manifest.json tidak ada — node sync.mjs --generate-manifest"; else `diffManifest(...).missing.length > 0` → **warn** "N plugin di manifest belum terpasang".
- `rules`: `!hasRules` → **warn** "rules.md tidak ada — jalankan /skillset:init".
- `duplicates`: `catalog.duplicates?.length > 0` → **warn** "N pasangan duplikat (lihat catalog.md)".
- `skillset-src`: hanya bila `srcVersion && installedVersion` keduanya truthy; beda → **warn** "source vX ≠ terpasang vY — bump versi & publish, atau reinstall".

`main`: baca `catalog.json` (tidak ada → null; JSON invalid → pesan + **exit 2**), `installed_plugins.json` (invalid → **2**), `manifest.json` (tidak ada → null; invalid → **2**), `rules.md` exists di dataDir. `--skillset-src <dir>`: baca `<dir>/.claude-plugin/plugin.json` → `srcVersion`; installedVersion = entri `skillset@*` dari installed. Output: baris `[ok|warn|fail] id — detail` (atau JSON bila `--json`). Exit: ada warn/fail → 1; semua ok → 0.

- [ ] **Step 1: Write the failing tests** di `tests/doctor.test.mjs`:

```js
function okInputs() {
  return {
    catalog: { generatedAt: new Date().toISOString(), plugins: [], duplicates: [] },
    installed: [],
    manifest: { autoUpdate: true, plugins: [] },
    hasRules: true,
  };
}

test('doctorChecks: healthy inputs all ok', () => {
  const checks = doctorChecks(okInputs());
  assert.equal(checks.some((c) => c.status !== 'ok'), false);
});

test('doctorChecks: stale catalog warns; future generatedAt stays ok', () => {
  const stale = doctorChecks({ ...okInputs(), catalog: { generatedAt: '2020-01-01T00:00:00.000Z', plugins: [], duplicates: [] }, now: new Date('2026-10-24T00:00:00.000Z') });
  assert.ok(stale.find((c) => c.id === 'catalog' && c.status === 'warn'));
  const future = doctorChecks({ ...okInputs(), catalog: { generatedAt: '2999-01-01T00:00:00.000Z', plugins: [], duplicates: [] }, now: new Date('2026-10-24T00:00:00.000Z') });
  assert.equal(future.find((c) => c.id === 'catalog').status, 'ok');
});

test('doctorChecks: drift, manifest-missing-entry, no-rules, duplicates, src-mismatch warn', () => {
  const r = doctorChecks({
    catalog: { generatedAt: new Date().toISOString(), plugins: [{ name: 'a', marketplace: 'm', version: '1.0.0', skills: [], commands: [], agents: [] }], duplicates: [{ a: 'x:s', b: 'y:s', kind: 'skill', similarity: 1, sameName: true }] },
    installed: [{ key: 'a@m', version: '2.0.0' }],
    manifest: { autoUpdate: true, plugins: ['ghost@zz'] },
    hasRules: false,
    srcVersion: '0.2.0', installedVersion: '0.1.1',
  });
  const ids = Object.fromEntries(r.map((c) => [c.id, c.status]));
  assert.equal(ids.drift, 'warn');
  assert.equal(ids.manifest, 'warn');
  assert.equal(ids.rules, 'warn');
  assert.equal(ids.duplicates, 'warn');
  assert.equal(ids['skillset-src'], 'warn');
  assert.equal(ids.catalog, 'ok');
});

test('doctor main: invalid catalog exits 2; healthy dir exits 0; --json prints checks', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-doctor-'));
  const dataDir = join(dir, 'data');
  const pluginsFile = join(dir, 'installed_plugins.json');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {} }));
  writeFileSync(join(dataDir, 'catalog.json'), '{invalid');
  assert.equal(await main(['--data-dir', dataDir, '--plugins-file', pluginsFile]), 2);
  writeFileSync(join(dataDir, 'catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), plugins: [], duplicates: [] }));
  writeFileSync(join(dataDir, 'manifest.json'), JSON.stringify({ autoUpdate: true, plugins: [] }));
  writeFileSync(join(dataDir, 'rules.md'), '# rules\n');
  assert.equal(await main(['--data-dir', dataDir, '--plugins-file', pluginsFile]), 0);
  assert.equal(await main(['--data-dir', dataDir, '--plugins-file', pluginsFile, '--json']), 0);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests, verify FAIL** — `node --test tests/doctor.test.mjs` → FAIL (modul tidak ada).

- [ ] **Step 3: Implement** `scripts/doctor.mjs` sesuai semantik check di atas (header komentar satu baris gaya sync.mjs; guard `endsWith('doctor.mjs')`).

- [ ] **Step 4: Run full suite** — `node --test tests/*.test.mjs` → all PASS.

- [ ] **Step 5: Commit** — `git add scripts/doctor.mjs tests/doctor.test.mjs && git commit -m "feat(skillset): doctor.mjs audit konsistensi report-only exit 0/1/2"`

### Task 3: Hook SessionStart warn-only

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/session-start.mjs`
- Test: `tests/hook.test.mjs`

**Interfaces:**
- Consumes: `checkDrift` (scan.mjs), `readInstalledUserPlugins/readJson/defaultPaths` (lib.mjs).
- Produces: `sessionStartCheck({ pluginsFile, dataDir } = {})` → `{ message }` — `message: ''` saat fresh **atau** saat input malformed; drift → pesan mengandung `/skillset:update`; catalog tidak ada → pesan mengandung `/skillset:init`. `main()` selalu exit 0, print message bila tidak kosong. `hooks/hooks.json` memanggil `node "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs"`.

- [ ] **Step 1: Write the failing tests** di `tests/hook.test.mjs`:

```js
test('sessionStartCheck: fresh silent, drift suggests update, missing catalog suggests init, malformed silent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'skillset-hook-'));
  const dataDir = join(dir, 'data');
  const pluginsFile = join(dir, 'installed_plugins.json');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {} }));
  writeFileSync(join(dataDir, 'catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), plugins: [], duplicates: [] }));
  assert.equal(sessionStartCheck({ pluginsFile, dataDir }).message, '');
  writeFileSync(join(dataDir, 'catalog.json'), JSON.stringify({ generatedAt: new Date().toISOString(), plugins: [{ name: 'a', marketplace: 'm', version: '1.0.0' }], duplicates: [] }));
  writeFileSync(pluginsFile, JSON.stringify({ plugins: { 'a@m': [{ scope: 'user', installPath: join(dir, 'x'), version: '2.0.0' }] } }));
  assert.match(sessionStartCheck({ pluginsFile, dataDir }).message, /\/skillset:update/);
  writeFileSync(pluginsFile, JSON.stringify({ plugins: {} }));
  rmSync(join(dataDir, 'catalog.json'));
  assert.match(sessionStartCheck({ pluginsFile, dataDir }).message, /\/skillset:init/);
  writeFileSync(pluginsFile, '{broken');
  assert.equal(sessionStartCheck({ pluginsFile, dataDir }).message, '');
  rmSync(dir, { recursive: true, force: true });
});

test('hooks.json valid & wired to session-start.mjs', () => {
  const j = JSON.parse(readFileSync(new URL('../hooks/hooks.json', import.meta.url), 'utf8'));
  const entry = j.hooks.SessionStart[0];
  assert.match(entry.matcher, /startup/);
  assert.match(entry.hooks[0].command, /session-start\.mjs/);
});
```

- [ ] **Step 2: Run tests, verify FAIL** — `node --test tests/hook.test.mjs` → FAIL (modul tidak ada).

- [ ] **Step 3: Implement**:
  - `hooks/session-start.mjs`: `export function sessionStartCheck({ pluginsFile = defaultPaths().pluginsFile, dataDir = defaultPaths().dataDir } = {})` — try/catch semua pembacaan; baca installed + catalog → `checkDrift` → susun `message` sesuai semantik; guard `main()` bila `process.argv[1].endsWith('session-start.mjs')`: `const { message } = sessionStartCheck(); if (message) console.log(message); process.exit(0);` (SELALU exit 0).
  - `hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs\"", "shell": "bash", "async": false }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Run full suite + validate** — `node --test tests/*.test.mjs` all PASS; `claude plugin validate .` → pass.

- [ ] **Step 5: Commit** — `git add hooks/ tests/hook.test.mjs && git commit -m "feat(skillset): hook SessionStart warn-only — cek drift baca-saja, selalu exit 0"`

### Task 4: Command doctor + docs + bump 0.2.0

**Files:**
- Create: `commands/doctor.md`
- Modify: `README.md` (tabel Commands + baris `/skillset:doctor`)
- Modify: `docs/manual-verification.md` (+ section doctor & hook)
- Modify: `.claude-plugin/plugin.json` & `.claude-plugin/marketplace.json` (version `0.1.1` → `0.2.0`)

**Interfaces:**
- Consumes: `scripts/doctor.mjs` (Task 2), `hooks/session-start.mjs` (Task 3).
- Produces: command `/skillset:doctor` terdaftar; versi 0.2.0 di kedua manifest.

- [ ] **Step 1: Write** `commands/doctor.md` mengikuti pola `commands/update.md` (frontmatter `description` Indonesia + `allowed-tools: Bash`): jalankan `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --skillset-src <repo skillset bila ada>`, laporkan tiap check warn/fail + saran perbaikannya, ringkas status akhir. Ingatkan: doctor hanya melapor, tidak mengubah apa pun.
- [ ] **Step 2: README** — tambah baris tabel: `| /skillset:doctor | Consistency audit: catalog, drift, manifest, rules, duplicates |` (English, konsisten README baru).
- [ ] **Step 3: manual-verification.md** — tambah item centang: (a) `node scripts/doctor.mjs` di data nyata → exit 0 atau 1 dengan check terbaca; (b) `node hooks/session-start.mjs` manual → keluar tanpa output saat katalog fresh; (c) ubah satu versi di katalog → hook mencetak 1 baris `/skillset:update`; kembalikan.
- [ ] **Step 4: Bump** `version` → `0.2.0` di `plugin.json` + `marketplace.json`.
- [ ] **Step 5: Verify** — `node --test tests/*.test.mjs` all PASS; `claude plugin validate .` pass.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore(skillset): rilis 0.2.0 — command doctor, docs wave 1, bump versi"`

## Self-Review Notes

- Spec coverage: 3 keputusan desain roadmap (hook warn-only, doctor report-only, duplikat konservatif) → Task 3, Task 2, Task 1; kontrak exit → semua task. ✓
- Type consistency: `findDuplicates`/`doctorChecks`/`sessionStartCheck` dipakai konsisten lintas task; `catalog.duplicates` dibaca Task 2 sesuai bentuk Task 1. ✓
- Proportion: plan ~1/3 kode aktual yang dihasilkan — body hanya untuk algoritma yang ditentukan spec (tokenisasi/Jaccard, semantik check). ✓
