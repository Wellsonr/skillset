---
description: Router — full lifecycle dari ide sampai release (plan → implement → test → review → PR → deploy).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

Task user: $ARGUMENTS

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read, lalu ikuti prosedur router di sana dengan:

- **Archetype development** (rantai titik-awal, sesuaikan per task lewat hasil query):
  1. `superpowers:brainstorming` — klasifikasi & desain
  2. `mattpocock-skills:codebase-design` + `mattpocock-skills:domain-modeling` — bila struktur/domain signifikan
  3. `superpowers:writing-plans`
  4. `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  5. `mattpocock-skills:code-review`
  6. `superpowers:verification-before-completion`
  7. `superpowers:requesting-code-review` → `superpowers:receiving-code-review`
  8. `superpowers:finishing-a-development-branch`
  9. `commit-commands:commit-push-pr`
  10. Deploy sesuai stack terdeteksi dari query: `vercel:deploy` / `cloudflare:wrangler` / `ecc:pm2` / pola docker (`docker:build:prod`)
