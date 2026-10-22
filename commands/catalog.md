---
description: Browse katalog skill semua plugin user-scope (ringkasan per plugin atau cari keyword).
allowed-tools: Bash
---

Argumen `$ARGUMENTS` = keyword opsional.

- Bila ADA keyword: `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" $ARGUMENTS` lalu tampilkan hasilnya apa adanya.
- Bila KOSONG: `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" --summary` lalu tampilkan ringkasan per plugin.

Bila output menyatakan katalog belum ada: sarankan `/skillset:init`. Jangan meringkas isi katalog dengan asumsi sendiri — tampilkan hasil script.
