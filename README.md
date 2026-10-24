# skillset

Claude Code plugin: a single-entry router for skills across all your user-scope plugins.

## Install (GitHub marketplace)

    claude plugin marketplace add Wellsonr/skillset
    claude plugin install skillset@skillset

Restart your Claude Code session after installing or updating.

## Commands

| Command | Purpose |
|---|---|
| `/skillset:init` | Bootstrap: manifest (all user-scope plugins) → install missing → update all → generate catalog + starter rules |
| `/skillset:update` | Update all plugins to the latest version + regenerate the catalog |
| `/skillset:make <task>` | Router: idea → working code |
| `/skillset:development <task>` | Router: full lifecycle through release |
| `/skillset:plan <task>` | Router: produce an implementation plan |
| `/skillset:execute <plan>` | Router: execute an existing plan |
| `/skillset:review` | Router: review the current session's changes |
| `/skillset:rules` | Manage custom rules (workflow-only) |
| `/skillset:catalog` | Browse the skill catalog |

## Data

Runtime state (not part of the repo): `~/.claude/skillset/data/` — `manifest.json`, `rules.md`, `catalog.json`, `catalog.md`.

## Development

    node --test tests/*.test.mjs   # unit tests for all scripts
    claude plugin validate .       # run from the repo root

Spec: `docs/superpowers/specs/2026-10-22-skillset-plugin-design.md` · Plan: `docs/superpowers/plans/2026-10-22-skillset-plugin.md`
