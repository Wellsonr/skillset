# Manual Verification — skillset v0.2.0

Perform after installation (restart the session). Check off when passing.

## Unit & structure
- [ ] `node --test tests/*.test.mjs` → all PASS (lib, scan, sync, query, doctor, hook)
- [ ] `claude plugin validate .` → passes
- [ ] `node scripts/scan.mjs --data-dir /tmp/skillset-smoke --plugins-file tests/fixtures/installed.json` → catalog generated in /tmp/skillset-smoke
- [ ] `node scripts/scan.mjs --check --data-dir /tmp/skillset-smoke --plugins-file tests/fixtures/installed.json` → exit 0; change a fixture version → exit 1
- [ ] (after `/skillset:init`) `node scripts/sync.mjs --dry-run` → exit 0, `dryRunCommands` printed, no real spawns
- [ ] `mkdir -p /tmp/skillset-smoke-bad && printf '{bad' > /tmp/skillset-smoke-bad/manifest.json && node scripts/sync.mjs --data-dir /tmp/skillset-smoke-bad` → exit 2, message contains `manifest.json is invalid` (not `sync failed`) — separate dir so the other checks stay idempotent
- [ ] `mkdir -p /tmp/skillset-smoke-fail && printf '{"autoUpdate":true,"plugins":["nonexistent-plugin@nowhere"]}' > /tmp/skillset-smoke-fail/manifest.json && node scripts/sync.mjs --data-dir /tmp/skillset-smoke-fail --plugins-file tests/fixtures/installed.json` → **exit 0** even though `failed` contains an entry (non-blocking verified)

## /skillset:init (end-to-end, touches the real home directory — this is the plugin's purpose)
- [ ] `/skillset:init` → manifest generated containing the current user-scope plugins; `~/.claude/skillset/data/catalog.md` exists and includes superpowers and others
- [ ] A plugin that fails to update (if any) is reported, and the workflow still completes
- [ ] `rules.md` is created from the template; re-run `/skillset:init` → rules are NOT overwritten

## /skillset:catalog & query
- [ ] `/skillset:catalog` → summary per plugin
- [ ] `/skillset:catalog tdd` → query results with plugin prefix

## Router
- [ ] `/skillset:make add CSV export button to the dashboard` → pre-flight runs; the proposed chain is shown (brainstorming…verification); NO execution before confirmation
- [ ] Trivial task (a real small question) → router answers directly without a chain

## Drift
- [ ] Run `claude plugin update superpowers`, then `node scripts/scan.mjs --check` → exit 1 (drift detected); then run `/skillset:update` (or `node scripts/scan.mjs`) so the catalog is fresh again

## Doctor & SessionStart hook
- [ ] `node scripts/doctor.mjs` on real data → exit 0 or 1 with each check readable (catalog/drift/manifest/rules/duplicates/skillset-src)
- [ ] `node hooks/session-start.mjs` run manually → exits with no output when the catalog is fresh
- [ ] Change one version in `~/.claude/skillset/data/catalog.json` → `node hooks/session-start.mjs` prints 1 line suggesting `/skillset:update`; restore the catalog version as it was

## Token-saving mode
- [ ] `/skillset:make fix a typo in the README title` → sized **small**; proposal shows ≤3 skills with a model column and the trimmed steps; nothing runs before confirmation
- [ ] `/skillset:make add a login endpoint with JWT` → sized at least **medium** (auth is never below medium)
- [ ] `/skillset:make --full add a CSV export button` → `--full` stripped from the task; the full archetype chain is proposed
- [ ] Approve a **medium** chain with `verification-before-completion: haiku` → it may run in a Haiku subagent (small tasks stay inline by design); `brainstorming` always stays in the session model
- [ ] Remove the `## models` section from `rules.md` → router falls back to the built-in defaults; a legacy `## selalu` section is still honored as `always`
- [ ] `node scripts/query.mjs react vite` prints ≤5 short entries; `--full` restores up to 12 full descriptions

## Clean-up fixtures
- [ ] Restore the fixture: `git checkout -- tests/fixtures/installed.json`
- [ ] `rm -rf /tmp/skillset-smoke /tmp/skillset-smoke-bad /tmp/skillset-smoke-fail`
