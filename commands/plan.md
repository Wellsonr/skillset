---
description: Router — produksi implementation plan saja (riset → desain → plan; tanpa implementasi).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

Task user: $ARGUMENTS

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read, lalu ikuti prosedur router di sana dengan:

- **Archetype plan** (deliverable = dokumen plan, BERHENTI di plan — jangan implementasi):
  1. `mattpocock-skills:research` — bila perlu riset lib/pola
  2. `superpowers:brainstorming` — bila belum ada spec/disain (sampai spec disetujui user)
  3. `superpowers:writing-plans`
