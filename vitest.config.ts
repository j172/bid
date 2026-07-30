import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // .claude/worktrees holds separate git worktrees for background agents —
    // each is its own checkout with its own test files; running this
    // project's `npm run test` should only ever cover this checkout.
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
});
