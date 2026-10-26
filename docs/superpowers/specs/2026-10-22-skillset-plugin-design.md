# Skillset — Plugin Router Skill for Claude Code (Design Spec)

- **Date:** 2026-10-22
- **Status:** Draft → awaiting user review
- **Classification:** Architectural (new project, new plugin)
- **Selected approach:** A — Persistent catalog + router prompt + anti-stale check
- **Plugin repo:** `<repo-root>`

---

## 1. Summary & Goals

`skillset` is a Claude Code plugin that acts as **a single entry point (router/orchestrator) for hundreds of skills** from all plugins installed at user scope (superpowers, mattpocock-skills, ecc, vercel, figma, expo, cloudflare, postman, stripe, redis-development, plugin-dev, frontend-design, pr-review-toolkit, commit-commands, etc.).

Users only need to call one command based on **intent** (e.g. `/skillset:make`, `/skillset:development`), and the plugin:

1. Guarantees that all required plugins are **installed and always latest** (auto-install + auto-update).
2. Reads a **skill catalog** that is generated automatically from the installed plugins.
3. **Matches the task** with a combination of skills across plugins, proposes a chain with reasons, waits for confirmation, and then executes the chain in sequence.
4. Applies the **user's custom rules** while the workflow runs.

**Success criteria:**
- `/skillset:init` on a new machine → all manifest plugins installed, updated to latest, catalog generated.
- `/skillset:make "add date filter to dashboard"` → proposes a relevant skill chain (from superpowers/mattpocock/ecc/…), waits for confirmation, then executes with rules active.
- Version drift of plugins is detected cheaply on each command invocation.
- Trivial tasks are not forced into a workflow (the router answers directly).

## 2. Design Decisions (locked)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Rules scope | **Workflow-only** — rules are active only within the plugin's commands, with no global hooks | Does not touch regular Claude Code sessions; safer and simpler |
| D2 | Routing behavior | **Propose → confirm** before executing the chain | Safe from guessing intent wrong; still only one round-trip |
| D3 | Initial manifest | **All user-scope plugins currently installed**, editable | Matches the user's wish; the file can be edited at any time |
| D4 | Auto-update | `/init` and `/update` run `claude plugin update` for all manifest plugins + `marketplace update` | "Always latest"; a cheap drift check in between |
| D5 | Architecture | **Approach A** — persistent catalog (generated) + router prompt | Transparent, fast, debuggable; can be upgraded to subagent (C) later without changing the data shape |
| D6 | Command set | **9 complete commands from the start** (init, update, make, development, plan, execute, review, rules, catalog) | Explicit request: commands initialized completely from the beginning |
| D7 | Skill chain archetypes | Defined **by the plugin designer** (§6 table); the router adapts per task | Explicit user request |
| D8 | Runtime data location | `~/.claude/skillset/data/` — **outside the plugin repo** | Not committed; survives plugin updates; safe when the plugin is shared |

## 3. Plugin Architecture

### 3.1 Identity

- Plugin name: `skillset` (kebab-case), initial version `0.1.0`.
- Distribution: this git repo; installation via local marketplace (`claude plugin marketplace add <path|repo>` → `claude plugin install skillset@<marketplace>`). Publishing to a public marketplace = out of scope for v1.

### 3.2 Directory structure

```
skillset/                            ← plugin repo (source)
├── .claude-plugin/plugin.json       ← plugin manifest (name, version, description, author)
├── commands/                        ← 9 slash commands (.md)
│   ├── init.md        update.md     ├── make.md       development.md
│   ├── plan.md        execute.md    ├── review.md
│   └── rules.md       catalog.md
├── skills/
│   └── router/SKILL.md              ← shared routing procedure (used by all router commands)
├── scripts/                         ← Node ESM (.mjs), zero-dependency
│   ├── scan.mjs                     ← scan installed plugins → generate catalog; --check = anti-stale
│   ├── sync.mjs                     ← manifest ↔ installed: install missing + update all
│   └── query.mjs                    ← filter catalog per keyword (saves routing tokens)
├── templates/rules.template.md      ← initial rules.md template
├── docs/
│   ├── superpowers/specs/…          ← this spec
│   └── manual-verification.md       ← manual verification checklist per command
├── tests/scan.test.mjs              ← unit tests for scan.mjs (fixtures)
└── README.md

~/.claude/skillset/data/             ← runtime (outside the repo, D8)
├── manifest.json                    ← required plugins (editable)
├── rules.md                         ← custom rules (editable)
├── catalog.json                     ← machine catalog (generated)
└── catalog.md                       ← human-readable catalog (generated)
```

Structural rules follow Claude Code's official plugin conventions: the manifest must be at `.claude-plugin/plugin.json`; `commands/`, `skills/`, `scripts/` at the plugin root; portable paths use `${CLAUDE_PLUGIN_ROOT}`.

### 3.3 DRY router principle

The five router commands (`make`, `development`, `plan`, `execute`, `review`) share a single routing procedure in `skills/router/SKILL.md`. The command `.md` files are **thin wrappers**: frontmatter (`argument-hint`) + an instruction "follow skill `skillset:router` with archetype X and task `$ARGUMENTS`". If invoking the skill internally causes problems during implementation, the fallback = the same inline template in each command (the decision is made at build time and does not change the data shape).

## 4. Data Model

### 4.1 `manifest.json`

```json
{
  "autoUpdate": true,
  "plugins": ["superpowers@claude-plugins-official", "mattpocock-skills@…", "…"]
}
```

- Created automatically on the first `/init`: contents = all plugins with scope `user` in `installed_plugins.json` (D3).
- Can be edited manually or by re-running `/skillset:init`; `sync.mjs` reads it.

### 4.2 `rules.md`

Markdown with sections; each section = a trigger scope; read by both humans and the router:

```markdown
## always
- Each progress step (phase completed / milestone) → update related documentation in docs/

## init
- Read CLAUDE.md + docs/ of the project first before starting the workflow

## web-project
- Must include a service-worker (PWA-ready)
- Login form: support Tab navigation + submit via Enter
```

- The `always` scope is always active; other scopes are active when their trigger matches the task (router's judgment). Scope names are free-form tags; the trigger description may be written as a `<!-- trigger: … -->` comment under the header.
- `/skillset:rules` = view / add / edit with a consistent format; the file remains plain markdown that can be edited manually.

### 4.3 `catalog.json` + `catalog.md` (generated)

```json
{
  "generatedAt": "2026-10-22T04:39:00.000Z",
  "plugins": [
    {
      "name": "superpowers",
      "marketplace": "claude-plugins-official",
      "version": "6.4.1",
      "skills":      [{ "name": "brainstorming", "description": "…" }],
      "commands":    [{ "name": "…", "description": "…" }],
      "agents":      [{ "name": "…", "description": "…" }]
    }
  ]
}
```

- `catalog.md` = human-readable condensate: grouped per plugin, one line `name — description` per skill/command/agent. This is what the router reads (via `query.mjs`), not the raw file with 600+ skills.

## 5. Scripts

All are zero-dependency Node ESM. Commands reference them with `!`node ${CLAUDE_PLUGIN_ROOT}/scripts/…``.

### 5.1 `scan.mjs`
- Source: `~/.claude/plugins/installed_plugins.json` → entries with `scope === "user"` (plus the installPath for each plugin).
- Walk per plugin: `skills/*/SKILL.md`, `commands/*.md`, `agents/*.md` → parse frontmatter `name` + `description` (simple regex; must tolerate multi-line plain-scalar values).
- Output: `catalog.json` + `catalog.md` (written to `~/.claude/skillset/data/`).
- `--check` mode: compare the set `{plugin@marketplace → version}` in `installed_plugins.json` vs `catalog.json`; print JSON `{"fresh": bool, "changes": […]}`; exit code 0 = fresh, 1 = drift/catalog missing. Fast, no network — used as a pre-flight check by every router command.

### 5.2 `sync.mjs`
- Read `manifest.json`; list installed plugins (exact flag for `claude plugin list` to be verified during implementation).
- For missing ones → `claude plugin install <plugin>@<marketplace>`.
- `claude plugin marketplace update` + `claude plugin update <plugin>` for each manifest plugin.
- Summary of results (success/failure per plugin) as output; interactive/`-y` flags to be verified during implementation.

### 5.3 `query.mjs`
- Arguments: keyword(s). Read `catalog.json`, score keyword matches in `name` + `description`, print the top entries per category (skill/command/agent) with plugin prefix — concise output for command context.

## 6. Command Set & Chain Archetypes

### 6.1 Shared routing procedure (`skills/router/SKILL.md`)

1. **Pre-flight anti-stale** — `scan.mjs --check`; if drift → offer `/skillset:update` first.
2. **Selective load** — `query.mjs <keyword domain>` + `rules.md`; the catalog is NEVER read in full.
3. **Task analysis** — domain, stack, deliverable; detect trivial tasks → answer directly without a chain (§7).
4. **Choose chain** — archetype (§6.2) adjusted to conditions; substitution if a skill is unavailable (§7).
5. **Propose → confirm** (D2) — show: the chain (skill → role → reason), the rules that will become active, the plan files to be read.
6. **Execute the chain** via the Skill tool — in chain order; rules checked at each phase; each skill's internal gates (e.g. brainstorming approval) are respected by the router.
7. **Final summary** — results per phase + the "progress → docs" rule obligation.

### 6.2 Archetype per command (D7 — starting chain, the router adapts)

**`/skillset:make <task>`** — idea → working code:
1. `superpowers:brainstorming` (classification & design)
2. `mattpocock-skills:codebase-design` + `mattpocock-skills:domain-modeling` (when structure/domain is significant)
3. `superpowers:writing-plans`
4. `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd` (bidirectional substitution)
5. `mattpocock-skills:code-review`
6. `superpowers:verification-before-completion`

**`/skillset:development <task>`** — full lifecycle → release: all of `/make`, plus:
7. `superpowers:requesting-code-review` → `superpowers:receiving-code-review`
8. `superpowers:finishing-a-development-branch`
9. `commit-commands:commit-push-pr`
10. Deploy according to the detected stack: `vercel:deploy` / `cloudflare:wrangler` / `ecc:pm2` / docker pattern (`docker:build:prod`)

**`/skillset:plan <task>`** — stops at the plan:
1. `mattpocock-skills:research` (when library/pattern research is needed)
2. `superpowers:brainstorming` (when no spec exists yet — until the spec is approved)
3. `superpowers:writing-plans` → deliverable = plan document

**`/skillset:execute <plan-path>`** — run an existing plan:
1. Detect plan size: small → `superpowers:executing-plans`; large/parallelizable → `superpowers:subagent-driven-development`
2. During implementation: `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
3. Review between tasks (when subagent-driven): `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`
4. Closing: `superpowers:verification-before-completion` + report per task

**`/skillset:review`** — review the changes made in the current session:
1. Detect scope: uncommitted diff (`git status`); if clean → the session's last commit (log/reflog)
2. Main review: `mattpocock-skills:code-review`; if there is a PR → `pr-review-toolkit:review-pr`
3. Per-language reviewers according to file extensions in the diff: agents `ecc:typescript-reviewer`, `ecc:go-reviewer`, `ecc:php-reviewer`, etc.
4. Optional (proposed by the router when relevant): `ecc:pr-test-analyzer` (test coverage), `security-auditor` (diff touches auth/payment/env/secrets)
5. Output: findings sorted by severity + fix recommendations

**Non-router commands:**
- `/skillset:init` — ensure the data dir; generate the initial manifest if missing (D3); `sync.mjs` (install + update, D4); `scan.mjs`; copy `templates/rules.template.md` → `rules.md` if missing; summary.
- `/skillset:update` — `sync.mjs` + `scan.mjs` (also used after drift is detected).
- `/skillset:rules` — view/add/edit `rules.md` in a consistent format.
- `/skillset:catalog` — browse the catalog (per plugin, keyword, installed version) via `query.mjs`.

## 7. Error Handling & Edge Cases

- **Install/update failure** (network/marketplace): continue with what is installed, report failed plugins, do not block the workflow.
- **Skill in the chain unavailable** (plugin disabled/uninstalled): propose a substitute from the catalog (the two-way substitutions already defined, e.g. tdd superpowers⇄mattpocock; code-reviewer pr-review-toolkit⇄ecc) or skip with a note; ask the user for confirmation at proposal time (D2).
- **Catalog does not exist yet** (`/init` not run): the command detects this and offers to run `/skillset:init` first.
- **Version drift**: warning + offer `/skillset:update` (does not force it).
- **Trivial task** (small question, not a project): the router states that no chain is needed and answers directly.
- **Very large catalog**: token mitigation = always use `query.mjs`; full reads are prohibited by the router procedure.

## 8. Testing & Validation

- `claude plugin validate .` — gate for manifest and component structure.
- Unit tests `tests/scan.test.mjs` with fake plugin directory fixtures: frontmatter parsing (including multi-line descriptions), `--check` drift detection, catalog output.
- `docs/manual-verification.md` — manual verification checklist per command (workspace convention).
- `claude plugin eval` — postponed to v2 (YAGNI).

## 9. Scope Limits (v1 — deliberately not built)

- Rules enforcement via global hooks (D1 rules this out).
- Per-project rules (v1: user-global rules only).
- WebSocket/progress UI, public marketplace, Windows path support.
- Subagent router (Approach C) — upgrade path left open, data shape unchanged.

## 10. Research References

- Plugin structure & manifest: https://code.claude.com/docs/en/plugins/overview
- Hooks (studied, not used in v1): https://code.claude.com/docs/en/hooks
- Skills: https://code.claude.com/docs/en/skills
- CLI verified locally: `claude plugin install|update|list|validate`, `claude plugin marketplace add|update`
- Local references: skills `plugin-dev:plugin-structure`, `plugin-dev:command-development`, `plugin-dev:skill-development` (plugin-dev@anthropic-plugin-directory)
- Prior art (different positioning): `ecc:skill-scout` (search at skill-creation time, not runtime routing), `superpowers:using-superpowers` (internal routing within one plugin)
