---
description: Bootstrap skillset — generate manifest, install + update semua plugin manifest ke latest, generate katalog, siapkan rules.
allowed-tools: Bash
---

Jalankan langkah berikut lewat Bash satu per satu, sampaikan output penting apa adanya, lalu ringkas. Jangan menambah diagnosis sendiri kecuali diminta.

1. `mkdir -p ~/.claude/skillset/data`
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs" --generate-manifest` (aman: tidak menimpa manifest yang sudah ada)
3. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs"`
4. `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs"`
5. Bila `~/.claude/skillset/data/rules.md` belum ada: `cp "${CLAUDE_PLUGIN_ROOT}/templates/rules.template.md" ~/.claude/skillset/data/rules.md`

Ringkasan wajib: plugin baru ter-install, plugin ter-update, plugin gagal (+error), jumlah skill/command/agent di katalog, skipped, lokasi `manifest.json` & `rules.md`. Ingatkan user: restart sesi Claude Code bila ada plugin yang baru di-install/update agar versi baru aktif.
