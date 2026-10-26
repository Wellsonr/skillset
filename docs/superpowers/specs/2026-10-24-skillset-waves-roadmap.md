# Skillset Waves Roadmap — Wave 1 Design

> 2026-10-24. Roadmap of 7 features resulting from the review after v0.1.1. The full waves are in this document; wave 1 is executed now, waves 2–3 follow with their own plans.

## Background

v0.1.1 is live on GitHub (`main` = polyrepo split). Real pain points: (1) `claude plugin update` skips new content when `plugin.json` is not bumped — confirmed on 2026-10-23; (2) a stale catalog is only detected when the router command is run manually; (3) 38+ tests green, a catalog of 470 skills across plugins, and many duplicates — the manual substitution table in `skills/router/SKILL.md` is maintained by hand.

## Features per wave

- **Wave 1 (plan: `2026-10-24-skillset-wave1-doctor-dedup-hook.md`):** #1 `/skillset:doctor`, #7 cross-plugin duplicate detection, #2 SessionStart hook warn-only.
- **Wave 2:** #3 usage log + `/skillset:stats`, #6 custom chain template.
- **Wave 3:** #4 token-aware routing (ranking + token cost estimate), #5 rules v2 (trigger validation, per-project rules).

## Wave 1 design decisions (user: "gas" → my defaults, recorded as my decisions)

1. **Hook warn-only, never auto-updates.** SessionStart runs a read-only drift check. Stale catalog → a single warning line pointing to `/skillset:update`; missing catalog → suggest `/skillset:init`; ALWAYS exits 0, and **stays silent when fresh** — zero extra context in every healthy session.
2. **Doctor is report-only.** Never modifies plugin state. Checks: catalog exists + age (warn > 7 days), drift (reuses `checkDrift`), manifest↔installed (`diffManifest`), `rules.md` exists, duplicate summary, optional flag `--skillset-src <dir>` (source version vs installed — catches the forgotten bump/publish trap).
3. **Conservative duplicates.** Flag when Jaccard ≥ 0.6 over the tokens of `name + description` (lowercase, split on non-alphanumerics) OR when normalized names are identical — only across plugins, only within the same kind. Results go into `catalog.json.duplicates` + a section in `catalog.md`.

## Goals / Non-goals / Anti-goals (Wave 1)

- **Goals:** early detection of stale catalog/state; a single one-shot audit command; automatic signal of substitution-table duplication.
- **Non-goals:** any auto-fix (automatic update/install/bump), semantic similarity (embeddings), remote registry version checks.
- **Anti-goals:**
  - A hook that adds latency/context to every healthy session.
  - A doctor that triggers actions without user approval.
  - Noisy duplicate detection (false-positive flooding of catalog.md).

## Contract (following scan/query/sync)

- Exit: `0` healthy / `1` findings present / 2 malformed input.
- Zero-dependency: only `node:` builtins; ESM `.mjs`.
- Hook & doctor are **read-only** with respect to plugin state.
