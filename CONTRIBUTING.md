# Contributing to skillset

Thanks for helping! Bug reports, ideas and pull requests are all welcome.

## Reporting bugs and ideas

- Open an [issue](../../issues/new/choose) and pick a template. Include your Claude Code version, the skillset version (`claude plugin list`) and, for bugs, the output of `/skillset:doctor`.
- **Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Sending a pull request

1. Fork the repo and create a branch from `main`.
2. Make a focused change. One topic per pull request.
3. Add or update tests, then run them:

   ```bash
   node --test tests/*.test.mjs
   claude plugin validate .
   ```

4. Open the pull request and fill in the template. Everything is written in English, including commit messages.

Every pull request is reviewed by the maintainer before it can be merged. Nobody else can merge or publish releases.

## Please do not

- **Bump the version** in `.claude-plugin/plugin.json` or `marketplace.json`. The maintainer bumps the version and creates the release tag, because `claude plugin update` detects new releases by version.
- Add dependencies. skillset is zero-dependency on purpose (Node standard library only).
- Make a command, hook or prompt do more than its description says.

## Review is stricter than usual for these paths

skillset runs on users' machines, and its markdown files are prompts that Claude executes. Treat changes to these as security-sensitive and keep them small and well explained:

| Path | Why |
|---|---|
| `hooks/` | Runs automatically at session start |
| `scripts/` | Node scripts, including `sync.mjs`, which invokes the `claude` CLI |
| `commands/`, `skills/` | Prompts that steer what Claude does |
| `.claude-plugin/` | Manifests that control what gets installed |
| `.github/` | CI and repository automation |

## Development notes

- Layout and design: see the [README](README.md#development).
- `scripts/bench.mjs` regenerates the charts in `docs/assets/` from your own catalog. Only commit regenerated charts if you changed something that affects token counts.
