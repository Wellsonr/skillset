---
description: Lihat / tambah / edit rules custom skillset (~/.claude/skillset/data/rules.md).
allowed-tools: Read, Edit, Write, Bash
---

File rules: `~/.claude/skillset/data/rules.md`. Bila belum ada, salin dari `"${CLAUDE_PLUGIN_ROOT}/templates/rules.template.md"` dulu (Bash `cp`).

1. Baca dan tampilkan isi rules saat ini.
2. Tanyakan aksi user: lihat / tambah / ubah / hapus rule (atau user menyebutkan scope & isi langsung).
3. Saat menulis: pertahankan format — section `## <scope>` dengan bullet `- <aturan>`; scope `selalu` aktif di semua workflow; scope lain aktif bila triggernya cocok task; komentar `<!-- trigger: ... -->` opsional di bawah header untuk menjelaskan kapan scope aktif.
4. Tampilkan hasil akhir file dan konfirmasikan.
