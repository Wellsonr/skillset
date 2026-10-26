---
description: Browse the skill catalog of all user-scope plugins (per-plugin summary or keyword search).
allowed-tools: Bash
---

`$ARGUMENTS` = optional keyword.

- With a keyword: `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" $ARGUMENTS`, then show the result as-is.
- Without one: `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" --summary`, then show the per-plugin summary.

If the output says the catalog does not exist yet, suggest `/skillset:init`. Do not summarize the catalog from your own assumptions; show the script output.
