---
description: Router — review perubahan yang baru dikerjakan di sesi ini (diff uncommitted, atau commit terakhir bila tree bersih).
allowed-tools: Bash, Read, Skill, Agent, AskUserQuestion
---

Baca `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` dengan tool Read. Untuk review, tahap analisis/load diganti:

1. **Deteksi scope** lewat Bash: `git status --short`; bila kosong → `git log -5 --oneline` dan tanyakan commit mana yang direview.
2. **Review utama**: `mattpocock-skills:code-review`; bila ada PR aktif → `pr-review-toolkit:review-pr`.
3. **Reviewer per-bahasa** sesuai ekstensi file di diff (agent): `ecc:typescript-reviewer`, `ecc:go-reviewer`, `ecc:php-reviewer`, `ecc:python-reviewer`, dll. — pilih hanya yang relevan.
4. **Opsional** (usulkan bila relevan, user menyetujui): `ecc:pr-test-analyzer` (cakupan test), `security-auditor` (diff menyentuh auth/payment/env/secrets).
5. Tetap jalankan pre-flight anti-stale, rules, dan usulan→konfirmasi sesuai prosedur router. Output akhir: findings terurut severity + rekomendasi fix.
