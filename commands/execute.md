---
description: Router — eksekusi implementation plan yang sudah ada (pilih mode eksekusi sesuai ukuran plan).
argument-hint: "[path-ke-plan.md]"
allowed-tools: Bash, Read, Skill, AskUserQuestion
---

Plan user: $ARGUMENTS

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read, lalu ikuti prosedur router di sana dengan:

- **Archetype execute** (baca plan di path tersebut dulu, laporkan jumlah task-nya):
  1. Deteksi ukuran: plan kecil (≤ ~8 task) → `superpowers:executing-plans`; plan besar/paralelisabel → `superpowers:subagent-driven-development`
  2. Selama implementasi: `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
  3. Review antar-task (bila subagent-driven): `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`
  4. Penutup: `superpowers:verification-before-completion` + laporan hasil per task
