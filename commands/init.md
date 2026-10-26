---
description: Bootstrap skillset — generate the manifest, install + update all manifest plugins to latest, generate the catalog, set up rules.
allowed-tools: Bash
---

Run the following steps one by one via Bash, relay the important output as-is, then summarize. Do not add your own diagnosis unless asked.

1. `mkdir -p ~/.claude/skillset/data`
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs" --generate-manifest` (safe: never overwrites an existing manifest)
3. `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.mjs"`
4. `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs"`
5. If `~/.claude/skillset/data/rules.md` does not exist yet: `cp "${CLAUDE_PLUGIN_ROOT}/templates/rules.template.md" ~/.claude/skillset/data/rules.md`

Required summary: newly installed plugins, updated plugins, failed plugins (+ error), skill/command/agent counts in the catalog, skipped entries, and the locations of `manifest.json` and `rules.md`. Remind the user to restart the Claude Code session if any plugin was newly installed or updated so the new version takes effect.
