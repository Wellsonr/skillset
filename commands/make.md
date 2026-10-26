---
description: Router — build something from an idea into working code (propose a cross-plugin skill chain → confirm → execute).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, Agent, AskUserQuestion
---

User task: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` with the Read tool, then follow the router procedure there with:

- **Archetype make** (starting chain; adapt it per task using the query results):
  1. `superpowers:brainstorming` — classification & design
  2. `mattpocock-skills:codebase-design` + `mattpocock-skills:domain-modeling` — when the structure/domain is significant
  3. `superpowers:writing-plans` — implementation plan
  4. `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  5. `mattpocock-skills:code-review`
  6. `superpowers:verification-before-completion`
