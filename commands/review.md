---
description: Router — review the changes made in this session (uncommitted diff, or the latest commit when the tree is clean).
allowed-tools: Bash, Read, Skill, Agent, AskUserQuestion
---

Read `${CLAUDE_PLUGIN_ROOT}/skills/router/SKILL.md` with the Read tool. For review, the analysis/load stage is replaced:

1. **Detect scope** via Bash: `git status --short`; if empty → `git log -5 --oneline` and ask which commit to review.
2. **Primary review**: `mattpocock-skills:code-review`; if there is an active PR → `pr-review-toolkit:review-pr`.
3. **Per-language reviewers** matching the file extensions in the diff (agents): `ecc:typescript-reviewer`, `ecc:go-reviewer`, `ecc:php-reviewer`, `ecc:python-reviewer`, etc. — pick only the relevant ones.
4. **Optional** (propose when relevant, the user approves): `ecc:pr-test-analyzer` (test coverage), `security-auditor` (the diff touches auth/payment/env/secrets).
5. Still run the anti-stale pre-flight, rules, and propose→confirm steps as the router procedure says. Final output: findings ordered by severity + fix recommendations.
