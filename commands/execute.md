---
description: Router — execute an existing implementation plan (pick the execution mode by plan size).
argument-hint: "[path-to-plan.md]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

User plan: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` with the Read tool, then follow the router procedure there with:

- **Archetype execute** (read the plan at that path first and report its task count):
  1. Detect size: small plan (≤ ~8 tasks) → `superpowers:executing-plans`; large or parallelizable plan → `superpowers:subagent-driven-development`
  2. During implementation: `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  3. Per-task review (when subagent-driven): `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`
  4. Wrap-up: `superpowers:verification-before-completion` + a per-task result report
