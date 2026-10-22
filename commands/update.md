---
description: Update semua plugin manifest ke latest + regenerate katalog skillset.
allowed-tools: Bash
---

Jalankan lewat Bash, sampaikan output penting apa adanya, lalu ringkas:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs"`
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs"`

Ringkasan wajib: ter-update, gagal (+error), jumlah entri katalog baru, skipped. Ingatkan: restart sesi bila ada plugin ter-update agar versi baru aktif.
