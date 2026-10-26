---
description: Update all manifest plugins to latest + regenerate the skillset catalog.
allowed-tools: Bash
---

Run via Bash, relay the important output as-is, then summarize:

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs"`
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs"`

Required summary: updated, failed (+ error), number of new catalog entries, skipped. Remind the user: restart the session if any plugin was updated so the new version takes effect.
