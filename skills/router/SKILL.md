---
name: router
description: Shared routing procedure for all skillset router commands (make/development/plan/execute/review) — anti-stale pre-flight, cross-plugin skill chain selection, propose-then-confirm, chained execution, rules application.
---

# Skillset Router Procedure

The calling command provides: an **archetype** (starting chain table) and a **task**. Follow these steps:

1. **Anti-stale pre-flight.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs" --check`.
   - Exit 1 with `missing-catalog` → offer to run `/skillset:init` first; do not continue until the user chooses.
   - Exit 1 with drift (`added`/`version`/`removed`) → offer `/skillset:update`; the user may decline and continue with the old catalog.
2. **Detect trivial tasks.** If the task is not a project/workflow (a small question, a one-line request), say that no skill chain is needed, answer directly, and stop.
3. **Selective load.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" <task domain keywords>` (MUST go through query — do NOT read the full `catalog.json`/`catalog.md`). Then `Read ~/.claude/skillset/data/rules.md`; if it does not exist → offer `/skillset:init`.
4. **Compose the chain.** Start from the command's archetype and adapt it to the query results (only skills that actually exist in the catalog). Substitute in both directions when a skill is unavailable:
   - `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
   - `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`
   - primary review: `mattpocock-skills:code-review` ⇄ `pr-review-toolkit:review-pr`

   A skill with no substitute → propose skipping it, with a note.
5. **Decide the active rules.** The `always` section is always active (`selalu` is accepted as a legacy alias for the same section); other sections (e.g. `web-project`) are active when their trigger matches the task. State which rules will be applied.
6. **PROPOSE → wait for explicit confirmation.** Show a table: skill → role → reason; active rules; files that will be read. Do NOT execute anything before the user approves (or edits and then approves).
7. **Chained execution.** Invoke skills via the Skill tool in order. Before each phase, check the rules relevant to that phase. Respect each skill's internal gates (e.g. the brainstorming approval is NOT bypassed).
8. **Final summary.** Results per phase, rules application status (e.g. which docs were updated), follow-up suggestions (`/skillset:review`, `/skillset:update`, etc.).
