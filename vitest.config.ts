import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json's "@/*" -> "./*" path mapping — Vite doesn't read
    // tsconfig paths on its own. Most existing lib/*.test.ts files never
    // needed this (their only "@/..." imports are `import type`, erased at
    // compile time), but lib/homepageSections.ts and lib/pigeonGallery.ts
    // import `getDb` from "@/lib/db" as a real runtime value, so their tests
    // need this alias to resolve (and to mock the module via vi.mock).
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // .claude/worktrees holds separate git worktrees for background agents —
    // each is its own checkout with its own test files; running this
    // project's `npm run test` should only ever cover this checkout.
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
});
