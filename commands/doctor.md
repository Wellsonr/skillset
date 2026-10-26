---
description: Consistency audit of skillset (catalog, drift, manifest, rules, duplicates) — report-only.
allowed-tools: Bash
---

`$ARGUMENTS` = optional flags (e.g. `--skillset-src <dir>`).

- With arguments: `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs" $ARGUMENTS`
- Without: `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"`

Run it via Bash, relay the important output as-is, then summarize.

Required summary: every check with status `warn`/`fail` together with its suggested fix (already listed in each row's detail), then the final status (exit 0 = all ok, 1 = warn/fail present, 2 = invalid data file). Remind the user: doctor only reports and changes nothing — propose follow-ups (e.g. `/skillset:init`, `/skillset:update`) first and do not run them without confirmation.
