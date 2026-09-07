# AGENTS.md

## Project

This repository is a Next.js App Router application using TypeScript, React,
next-intl, MySQL, Vitest, ESLint, and Tailwind CSS. The required Node.js
version is 24 or newer.

`AGENTS.md` is the shared source of truth for coding agents. Tool-specific
entry files must remain thin adapters and must not duplicate this document.

## Before changing code

1. Read this file and any more-specific `AGENTS.md` in the target directory.
2. Read the relevant files under `docs/agents/` when the task touches their
	 subject area.
3. For Next.js changes, read the applicable guide under
	 `node_modules/next/dist/docs/` and preserve the generated Next.js rules
	 block below.
4. Inspect the existing implementation and tests before choosing an approach.

## Commands

- Development: `npm run dev`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Tests: `npm test`
- Production build: `npm run build`

Run the narrowest relevant checks while iterating, then run the full relevant
set before handing work off. Do not claim a check passed without running it.

## Safety and repository conventions

- Never read, print, commit, or modify secrets in `.env` or other local-only
	configuration unless the task explicitly requires a safe, non-secret change.
- Do not use destructive Git commands such as hard reset, clean, or forced
	deletion to discard work.
- Keep changes scoped to the request. Avoid unrelated formatting or migrations.
- Add or update tests when behavior changes; preserve existing public APIs unless
	the task requires a breaking change.
- Use the repository's existing domain terms and validation/error patterns.
- Treat deployment, authentication, database schema, and public API changes as
	high risk; explain verification and rollback considerations.

## Documentation wayfinding

- `docs/agents/domain.md` explains how to consume domain documentation. The
	referenced `CONTEXT.md` and `docs/adr/` are optional and are not present in
	the current checkout; proceed without inventing them.
- `docs/agents/issue-tracker.md` defines the GitHub issue workflow.
- `docs/agents/triage-labels.md` defines the canonical triage labels.
- Read incident-specific runbooks under `docs/agents/` only when relevant.

## Shared AI context

- Claude Code: read `CLAUDE.md`, then this file.
- GitHub Copilot: read `.github/copilot-instructions.md`, then this file.
- Google Antigravity (`google.google-antigravity`): keep this file as the
	canonical project context. Antigravity 1.2.0 exposes Rules through its UI
	and supports importing Cursor rules, but its public extension files do not
	establish a committed `AGENTS.md` discovery path. Do not create an
	undocumented `.agent/rules` file; import or attach this file through the
	Antigravity Rules workflow and verify the loaded rules in the UI.

When a tool-specific instruction conflicts with this file, prefer the more
specific instruction only when it is intentionally tool-specific; otherwise
surface the conflict instead of silently choosing one version.

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI (`origin` → https://github.com/j172/bid.git). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Read `docs/agents/domain.md` for the domain-documentation workflow. The
optional `CONTEXT.md` and `docs/adr/` paths are not present in this checkout.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
