---
name: router
description: Shared routing procedure for all skillset router commands (make/development/plan/execute/review) — anti-stale pre-flight, task sizing, lean cross-plugin skill chains, per-phase model delegation, propose-then-confirm, rules application.
---

# Skillset Router Procedure

The calling command provides: an **archetype** (full starting chain) and a **task**. If the task contains `--full`, strip it and skip sizing (step 4). Follow these steps:

1. **Anti-stale pre-flight.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs" --check`.
   - Exit 1 with `missing-catalog` → offer `/skillset:init` first; do not continue until the user chooses.
   - Exit 1 with drift (`added`/`version`/`removed`) → offer `/skillset:update`; the user may decline and continue.
2. **Detect trivial tasks.** If the task is a small question or one-line request, say no chain is needed, answer directly, and stop.
3. **Selective load.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" <task domain keywords>` (top 5, short descriptions; add `--full` only if nothing fits). NEVER read the full `catalog.json`/`catalog.md`. Then `Read ~/.claude/skillset/data/rules.md`; if missing → offer `/skillset:init`.
4. **Size the task** (`make`/`development` only; `plan`/`execute`/`review` keep their archetype):
   - **small** (1–3 files, clear change): `test-driven-development` → `verification-before-completion` (+ `commit-push-pr` for `development`).
   - **medium** (multi-file feature): `brainstorming` → `writing-plans` → TDD → `code-review` → `verification-before-completion` (+ commit for `development`).
   - **large** (new project, cross-cutting): the full archetype chain.
   - Never size below **medium** when the task touches auth, payments, DB migrations, or secrets.
5. **Compose the chain** from the sized chain, using only skills present in the catalog. Substitute both ways when unavailable: `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`; `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`; `mattpocock-skills:code-review` ⇄ `pr-review-toolkit:review-pr`. No substitute → propose skipping with a note.
6. **Active rules.** The `always` section is always active (`selalu` is a legacy alias); other sections (e.g. `web-project`) are active when their trigger matches the task.
7. **Assign a model per phase** from the `## models` section of `rules.md` (`skill: haiku|sonnet|opus|main`; `main` = stay in the session model). Missing section → `haiku` for verification, commit, finishing, doc sync; `sonnet` for implementation and reviews; `main` for everything else. Any skill that asks the user questions or needs approval ALWAYS stays `main`.
8. **PROPOSE → wait for explicit confirmation.** Show the size and a compact table (skill | model | reason in ≤8 words), the active rules, and which archetype steps were trimmed. Execute nothing before the user approves (or edits, then approves).
9. **Execute.** `main` phases: invoke via the Skill tool in order. Delegated phases: spawn an Agent with the chosen `model` and a self-contained prompt (goal, files, "invoke `<skill>` with the Skill tool, ask no questions, reply in ≤10 lines"). Delegate only mechanical, self-contained phases; otherwise run inline. Check relevant rules before each phase and respect each skill's internal gates.
10. **Final summary.** Results per phase, rules applied, what was trimmed and why, follow-ups (`/skillset:review`, `/skillset:update`, `--full` to rerun with the whole chain).
