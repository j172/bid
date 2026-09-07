# GitHub Copilot project instructions

Before answering a coding request or proposing a change, read and follow the
repository's shared instructions in [`AGENTS.md`](../AGENTS.md). That file is
the source of truth for the stack, commands, safety rules, documentation
wayfinding, and verification requirements.

Copilot-specific reminders:

- Read more-specific instruction files before editing files in their scope.
- Do not expose or modify secrets in `.env`.
- Keep changes focused and validate behavior with the narrowest relevant tests,
  lint, type check, or build before reporting completion.
- Preserve the generated Next.js rules block in `AGENTS.md`.