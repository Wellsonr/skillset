---
description: View / add / edit the custom skillset rules (~/.claude/skillset/data/rules.md).
allowed-tools: Read, Edit, Write, Bash
---

Rules file: `~/.claude/skillset/data/rules.md`. If it does not exist yet, copy it from `"${CLAUDE_PLUGIN_ROOT}/templates/rules.template.md"` first (Bash `cp`).

1. Read and show the current rules.
2. Ask the user for the action: view / add / change / remove a rule (or the user states the scope and content directly).
3. When writing, keep the format — a `## <scope>` section with `- <rule>` bullets; the `always` scope is active in every workflow (`selalu` is accepted as a legacy alias); other scopes are active when their trigger matches the task; an optional `<!-- trigger: ... -->` comment under the header explains when a scope is active.
4. Show the final file and confirm.
