---
description: Router — produce an implementation plan only (research → design → plan; no implementation).
argument-hint: "[task]"
allowed-tools: Bash, Read, Skill, Agent, AskUserQuestion
---

User task: $ARGUMENTS

Read `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` with the Read tool, then follow the router procedure there with:

- **Archetype plan** (the deliverable is a plan document; STOP at the plan — do not implement):
  1. `mattpocock-skills:research` — when library/pattern research is needed
  2. `superpowers:brainstorming` — when no spec/design exists yet (until the user approves the spec)
  3. `superpowers:writing-plans`
