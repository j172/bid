# Worktree and Subagent Flow

Each implementation ticket is isolated from the main checkout.

## Worktree naming

Use a branch and worktree derived from the issue:

`agent/issue-<number>-<short-kebab-title>`

Keep worktrees beside the repository, for example `../bid-issue-123`. Never use a second agent in the same worktree.

## Lifecycle

1. Claim the ticket with `gh issue edit <number> --add-assignee @me`.
2. Create the branch and worktree from the current `master`.
3. Give the subagent the issue, acceptance criteria, non-goals, worktree path, and required checks.
4. The subagent reads applicable `AGENTS.md` files and existing tests before editing.
5. The subagent implements only the ticket, runs the narrowest checks, and reports changed files, checks, risks, and follow-ups.
6. The parent agent reviews the diff against the ticket and creates a PR referencing the issue.
7. A separate reviewer checks scope, security, tests, and deployment impact before merge.
8. Merge only after required CI checks pass and the PR is approved.
9. Remove the worktree after merge only when no uncommitted work remains.

## Handoff format

```text
Issue: #<number>
Worktree: <absolute path>
Branch: agent/issue-<number>-<slug>
Acceptance criteria:
- ...
Non-goals:
- ...
Required checks:
- ...
Do not change:
- secrets, .env, unrelated files
```

The subagent must return:

- summary of implementation,
- files changed and why,
- checks run and results,
- known risks or blocked items,
- suggested PR title and body.

When the ticket changes `.github/` automation or agent files, the handoff must also record workflow YAML and custom-agent frontmatter validation.

## Safety boundaries

Subagents must not push directly to `master`, merge their own PR, deploy production, read `.env`, or alter GitHub secrets. Deployment is performed by the protected workflow after merge.