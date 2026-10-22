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
