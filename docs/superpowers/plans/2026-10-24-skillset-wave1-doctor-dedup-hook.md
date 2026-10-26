# Skillset Wave 1 (doctor + dedup + hook) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wave 1 plugin skillset — `/skillset:doctor` (consistency audit), cross-plugin duplicate skill detection in `scan.mjs`, SessionStart hook warn-only.

**Architecture:** Three additions on top of the existing pattern: pure functions in `scan.mjs` (+ duplicates go into the catalog), a new script `doctor.mjs` that consumes existing helpers, and a read-only hook that calls the same check logic as `scan --check`.

**Tech Stack:** Node ESM `.mjs`, zero-dependency (node: builtins), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-24-skillset-waves-roadmap.md`

## Global Constraints

- Zero-dependency: only import `node:` builtins.
- Script pattern: exported pure functions + thin `main(argv)` + guard `if (process.argv[1] && process.argv[1].endsWith('<file>'))`.
- Exit contract: `0` healthy / `1` findings present / `2` malformed input.
- Doctor & hook **read-only**; hook ALWAYS exits 0 and stays silent when fresh.
- Console messages in scripts are in English (follow `scan.mjs`/`sync.mjs`); `catalog.md` header is English.
- Full suite: `node --test tests/*.test.mjs` (glob form; directory form fails on Node 23.7.0). All existing tests (38) must stay green.
- One commit per task, conventional commits (`feat(skillset)/docs(skillset)/chore(skillset)`), in English.

## Review Focus

1. **Malformed JSON** in `catalog.json`/`installed_plugins.json`/`manifest.json` → doctor exits 2 with a message (not a stack trace); hook stays silent and exits 0. → Task 2 & Task 3.
2. **Empty catalog / empty description** → `findDuplicates` returns `[]` without error. → Task 1.
3. **Case/whitespace differences** ("Review Code" vs "review  code!") → still detected as duplicates (token normalization). → Task 1.
4. **`generatedAt` in the future** (clock skew) → treated as ok, not as a warning or negative age. → Task 2.
5. **`installed_plugins.json` broken at session start** → hook stays silent, exits 0, the session still runs. → Task 3.

---

### Task 1: `findDuplicates` + duplicates in the catalog

**Files:**
- Modify: `scripts/scan.mjs`
- Test: `tests/scan.test.mjs`

**Interfaces:**
- Consumes: existing `scanPlugins`, `renderCatalogMd`.
- Produces: `findDuplicates(catalog, { threshold = 0.6 } = {})` → array of `{ a, b, kind, similarity, sameName }` with `a`/`b` formatted as `"<plugin>:<item>"` (pair sorted alphabetically); `scanPlugins()` return adds a `duplicates` field (array, may be `[]`); `renderCatalogMd` renders a `## Duplicates` section (lines `- a ↔ b (similarity 0.82)`) only when duplicates exist.

- [ ] **Step 1: Write the failing tests** in `tests/scan.test.mjs` (import `findDuplicates`):

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

- [ ] **Step 3: Implement** in `scripts/scan.mjs`:
  - `export function findDuplicates(catalog, { threshold = 0.6 } = {})`: tokenization `tokens(s) = (s.toLowerCase().match(/[a-z0-9]+/g) || [])`; similarity = Jaccard `|∩|/|∪|` over the combined tokens of `name + ' ' + description` (empty set × empty set → similarity 0); compare pairs of items **of the same kind** (`skills`, `commands`, `agents`) **across plugins**; flag when `similarity >= threshold || sameName` (`sameName` = identical lowercase name); each pair is reported once with `a`/`b` sorted alphabetically.
  - `scanPlugins`: final result adds `duplicates: findDuplicates({ plugins })`.
  - `renderCatalogMd`: when `catalog.duplicates?.length`, push a `## Duplicates` section + lines `` - `a` ↔ `b` (similarity N, sameName?) ``.

- [ ] **Step 4: Run full suite** — `node --test tests/*.test.mjs` → all PASS (38 existing + 3 new).

- [ ] **Step 5: Commit** — `git add scripts/scan.mjs tests/scan.test.mjs && git commit -m "feat(skillset): detect cross-plugin duplicate skills in catalog"`

### Task 2: `doctor.mjs` — consistency audit (report-only)

**Files:**
- Create: `scripts/doctor.mjs`
- Test: `tests/doctor.test.mjs`

**Interfaces:**
- Consumes: `checkDrift(installed, catalog)` (scan.mjs), `diffManifest(manifest, installed)` (sync.mjs), `readJson/readInstalledUserPlugins/parseCliArgs/defaultPaths` (lib.mjs), `catalog.duplicates` (Task 1).
- Produces: `doctorChecks({ catalog, installed, manifest, hasRules, srcVersion = null, installedVersion = null, now = new Date() })` → array of `{ id, status: 'ok'|'warn'|'fail', detail }`; `main(argv)` → exit 0/1/2; flags: `--data-dir`, `--plugins-file`, `--skillset-src <dir>`, `--json`.

Check semantics (id → logic):
- `catalog`: `catalog == null` → **fail** "catalog.json not found — run /skillset:init"; else age = `now - Date.parse(generatedAt)`; age > 7 days → **warn**; negative age (future) → ok.
- `drift`: skip when catalog is null; `checkDrift` → `!fresh` → **warn** "N changes — run /skillset:update".
- `manifest`: `manifest == null` → **warn** "manifest.json not found — node sync.mjs --generate-manifest"; else `diffManifest(...).missing.length > 0` → **warn** "N plugin(s) in manifest not yet installed".
- `rules`: `!hasRules` → **warn** "rules.md not found — run /skillset:init".
- `duplicates`: `catalog.duplicates?.length > 0` → **warn** "N duplicate pair(s) (see catalog.md)".
- `skillset-src`: only when `srcVersion && installedVersion` are both truthy; different → **warn** "source vX ≠ installed vY — bump version & publish, or reinstall".

`main`: read `catalog.json` (missing → null; invalid JSON → message + **exit 2**), `installed_plugins.json` (invalid → **2**), `manifest.json` (missing → null; invalid → **2**), `rules.md` exists in dataDir. `--skillset-src <dir>`: read `<dir>/.claude-plugin/plugin.json` → `srcVersion`; installedVersion = the `skillset@*` entry from installed. Output: lines `[ok|warn|fail] id — detail` (or JSON with `--json`). Exit: any warn/fail → 1; all ok → 0.

- [ ] **Step 1: Write the failing tests** in `tests/doctor.test.mjs`:

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

- [ ] **Step 2: Run tests, verify FAIL** — `node --test tests/doctor.test.mjs` → FAIL (module does not exist).

- [ ] **Step 3: Implement** `scripts/doctor.mjs` according to the check semantics above (one-line header comment in the style of sync.mjs; guard `endsWith('doctor.mjs')`).

- [ ] **Step 4: Run full suite** — `node --test tests/*.test.mjs` → all PASS.

- [ ] **Step 5: Commit** — `git add scripts/doctor.mjs tests/doctor.test.mjs && git commit -m "feat(skillset): doctor.mjs report-only consistency audit, exit 0/1/2"`

### Task 3: SessionStart hook, warn-only

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/session-start.mjs`
- Test: `tests/hook.test.mjs`

**Interfaces:**
- Consumes: `checkDrift` (scan.mjs), `readInstalledUserPlugins/readJson/defaultPaths` (lib.mjs).
- Produces: `sessionStartCheck({ pluginsFile, dataDir } = {})` → `{ message }` — `message: ''` when fresh **or** when input is malformed; drift → message contains `/skillset:update`; missing catalog → message contains `/skillset:init`. `main()` always exits 0, prints the message if not empty. `hooks/hooks.json` calls `node "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs"`.

- [ ] **Step 1: Write the failing tests** in `tests/hook.test.mjs`:

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

- [ ] **Step 2: Run tests, verify FAIL** — `node --test tests/hook.test.mjs` → FAIL (module does not exist).

- [ ] **Step 3: Implement**:
  - `hooks/session-start.mjs`: `export function sessionStartCheck({ pluginsFile = defaultPaths().pluginsFile, dataDir = defaultPaths().dataDir } = {})` — try/catch around all reads; read installed + catalog → `checkDrift` → build `message` according to the semantics; guard `main()` when `process.argv[1].endsWith('session-start.mjs')`: `const { message } = sessionStartCheck(); if (message) console.log(message); process.exit(0);` (ALWAYS exit 0).
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

- [ ] **Step 5: Commit** — `git add hooks/ tests/hook.test.mjs && git commit -m "feat(skillset): SessionStart hook warn-only — read-only drift check, always exit 0"`

### Task 4: Doctor command + docs + bump to 0.2.0

**Files:**
- Create: `commands/doctor.md`
- Modify: `README.md` (Commands table + `/skillset:doctor` row)
- Modify: `docs/manual-verification.md` (+ doctor & hook section)
- Modify: `.claude-plugin/plugin.json` & `.claude-plugin/marketplace.json` (version `0.1.1` → `0.2.0`)

**Interfaces:**
- Consumes: `scripts/doctor.mjs` (Task 2), `hooks/session-start.mjs` (Task 3).
- Produces: command `/skillset:doctor` registered; version 0.2.0 in both manifests.

- [ ] **Step 1: Write** `commands/doctor.md` following the pattern of `commands/update.md` (frontmatter `description` in English + `allowed-tools: Bash`): run `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --skillset-src <skillset repo if available>`, report each warn/fail check with its suggested fix, summarize the final status. Remind that doctor only reports and does not change anything.
- [ ] **Step 2: README** — add table row: `| /skillset:doctor | Consistency audit: catalog, drift, manifest, rules, duplicates |` (English, consistent with the new README).
- [ ] **Step 3: manual-verification.md** — add checkbox items: (a) `node scripts/doctor.mjs` on real data → exit 0 or 1 with each check readable; (b) `node hooks/session-start.mjs` run manually → exits with no output when the catalog is fresh; (c) change one version in the catalog → hook prints 1 line suggesting `/skillset:update`; restore it.
- [ ] **Step 4: Bump** `version` → `0.2.0` in `plugin.json` + `marketplace.json`.
- [ ] **Step 5: Verify** — `node --test tests/*.test.mjs` all PASS; `claude plugin validate .` pass.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore(skillset): release 0.2.0 — doctor command, wave 1 docs, version bump"`

## Self-Review Notes

- Spec coverage: 3 roadmap design decisions (hook warn-only, doctor report-only, conservative duplicates) → Task 3, Task 2, Task 1; exit contract → all tasks. ✓
- Type consistency: `findDuplicates`/`doctorChecks`/`sessionStartCheck` used consistently across tasks; `catalog.duplicates` read in Task 2 matches the shape from Task 1. ✓
- Proportion: the plan yields roughly 1/3 of the actual code — bodies are only given for algorithms the spec defines (tokenization/Jaccard, check semantics). ✓
