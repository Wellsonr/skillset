---
description: Router — full lifecycle from idea to release (plan → implement → test → review → PR → deploy).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, Agent, AskUserQuestion
---

User task: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` with the Read tool, then follow the router procedure there with:

- **Archetype development** (starting chain; adapt it per task using the query results):
  1. `superpowers:brainstorming` — classification & design
  2. `mattpocock-skills:codebase-design` + `mattpocock-skills:domain-modeling` — when the structure/domain is significant
  3. `superpowers:writing-plans`
  4. `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  5. `mattpocock-skills:code-review`
  6. `superpowers:verification-before-completion`
  7. `superpowers:requesting-code-review` → `superpowers:receiving-code-review`
  8. `superpowers:finishing-a-development-branch`
  9. `commit-commands:commit-push-pr`
  10. Deploy according to the stack detected from the query: `vercel:deploy` / `cloudflare:wrangler` / `ecc:pm2` / docker pattern (`docker:build:prod`)
