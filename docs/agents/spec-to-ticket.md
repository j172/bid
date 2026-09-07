# Spec → Ticket

Use this flow when a request is not yet precise enough for implementation.

## 1. Write the spec

Capture the following before creating a ticket:

- **Outcome**: the user or business result, not an implementation detail.
- **Scope**: files, routes, data, and integrations that may change.
- **Non-goals**: explicitly excluded behavior.
- **Acceptance criteria**: observable, testable statements.
- **Risks**: authentication, database, deployment, migration, or rollback concerns.
- **Verification**: the narrowest tests plus any required build or smoke test.

Do not invent missing product decisions. Mark them as `Needs decision` and ask one focused question at a time.

## 2. Create the ticket

Create a GitHub Issue with `.github/ISSUE_TEMPLATE/spec.md`. Use `gh issue create` from the repository root and apply `needs-triage` first. A ticket is ready for implementation only when its acceptance criteria and verification steps are complete; then change the label to `ready-for-agent`.

## 3. Ticket quality gate

The ticket must identify:

1. the source spec or decision,
2. the expected behavior,
3. the affected surface,
4. test and deployment impact,
5. the definition of done,
6. the owner or next decision-maker.

If any item is unknown, use `needs-info` rather than assigning an agent.

## 4. Handoff

The implementing agent receives the issue number, repository root, target worktree path, and required checks. It must not broaden scope without updating the issue first.