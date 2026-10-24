---
description: Audit konsistensi skillset (katalog, drift, manifest, rules, duplikat) — report-only.
allowed-tools: Bash
---

Jalankan lewat Bash, sampaikan output penting apa adanya, lalu ringkas:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" --skillset-src <repo skillset bila ada>`

Ringkasan wajib: tiap check berstatus `warn`/`fail` beserta saran perbaikannya (sudah tercantum di detail tiap baris), lalu status akhir (exit 0 = semua ok, 1 = ada warn/fail, 2 = file data tidak valid). Ingatkan: doctor hanya melapor, tidak mengubah apa pun — tindak lanjut (mis. `/skillset:init`, `/skillset:update`) usulkan dulu, jangan eksekusi tanpa konfirmasi.
