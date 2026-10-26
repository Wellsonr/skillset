# Security Policy

## Supported versions

Only the latest release receives fixes. Update with:

```bash
claude plugin marketplace update skillset
claude plugin update skillset@skillset
```

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private reporting instead: open the **Security** tab of this repository and choose **Report a vulnerability**. Include what you found, how to reproduce it, and which version is affected.

This is a solo-maintained project, so replies are best effort, but reports are read and taken seriously.

## What is in scope

skillset runs code and prompts on your machine, so these are the areas that matter most:

- `hooks/`: runs automatically when a Claude Code session starts (designed to be read-only and to always exit 0).
- `scripts/sync.mjs`: invokes the `claude` CLI to install and update plugins.
- `commands/` and `skills/`: prompts that steer Claude's behavior.
- Anything that could make the plugin read or send data it should not.

## Release integrity

- Only the maintainer can push to `main` or create version tags (`v*`); tags cannot be moved or deleted.
- Pull requests are reviewed before merging.
- Official source: <https://github.com/Wellsonr/skillset>. Copies elsewhere are not maintained by this project.
