# Skillset Rules

The rules below apply only inside skillset workflow commands (`/skillset:make|development|plan|execute|review`), not in regular Claude Code sessions. The `always` section is active in every workflow; other sections are active when their trigger matches the task. Edit this file directly, or use `/skillset:rules`.

## always
- On every progress step (phase done / milestone) → update the related documentation in docs/

## init
- Read the project's CLAUDE.md + docs/ before starting a workflow

## web-project
<!-- trigger: task builds a new web frontend -->
- Always include a service worker (PWA-ready)
- Login forms: support Tab navigation + submit via Enter
