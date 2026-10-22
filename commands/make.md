---
description: Router — bangun sesuatu dari ide jadi kode bekerja (usulkan rantai skill lintas plugin → konfirmasi → eksekusi).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

Task user: $ARGUMENTS

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read, lalu ikuti prosedur router di sana dengan:

- **Archetype make** (rantai titik-awal, sesuaikan per task lewat hasil query):
  1. `superpowers:brainstorming` — klasifikasi & desain
  2. `mattpocock-skills:codebase-design` + `mattpocock-skills:domain-modeling` — bila struktur/domain signifikan
  3. `superpowers:writing-plans` — implementation plan
  4. `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  5. `mattpocock-skills:code-review`
  6. `superpowers:verification-before-completion`
