# Token-Saving Mode Implementation Plan

**Goal:** Cut the tokens a skillset workflow consumes without losing its safety gates (propose → confirm).

**Measured baseline (2026-10-26):** routing overhead ≈ 2,300 tokens (command ≈ 300, router SKILL.md ≈ 700, `query` output ≈ 1,000, rules ≈ 250, hook ≈ 30). The real cost is the chain: the 7 main skills of the full chain weigh ≈ 50 KB (≈ 12,500 tokens) versus ≈ 14 KB (≈ 3,500 tokens) for TDD + verification + commit, and every phase runs in the session model.

**Decisions (user, 2026-10-26):** lean mode is the default with automatic task sizing (`--full` overrides); mechanical phases are delegated to subagents with a cheaper model.

## Tasks
- [x] **1. Lean `query`** — default top 5, descriptions cut to 120 chars, `--full` restores top 12 + full text (`scripts/query.mjs`, 3 new tests). Result: 3.7 KB → 0.8 KB per query.
- [x] **2. Task sizing in the router** — small / medium / large chains, floor at medium for auth, payments, DB migrations and secrets, `--full` override (`skills/router/SKILL.md`).
- [x] **3. Model per phase** — `## models` section in the rules template, built-in fallback defaults, delegation rules (interactive skills stay in the session model), `Agent` added to `allowed-tools` of make/development/plan/execute.
- [x] **4. Docs** — README "Saving tokens" section, manual verification checklist, version 0.3.0.
- [x] **5. Verify and publish** — full test run, `claude plugin validate .`, fast-forward push to GitHub.

## Risks
- Mis-sizing under-plans a task → size is always shown in the proposal; floor rule; `--full`.
- Delegation can cost more than it saves for short phases → only mechanical, self-contained phases are delegated; subagents reply in ≤10 lines.
- Router behavior is prompt-level, so only task 1 has automated tests; the rest is covered by `docs/manual-verification.md`.
