// TypeScript 7 (issue #125) does not ship the classic Program/compiler API —
// only TypeScript 7.1+ is expected to. typescript-eslint (bundled inside
// eslint-config-next) still hard-requires that classic API and explicitly
// refuses to load under a TypeScript >=7 `require("typescript")`:
//   "typescript-eslint does not support TS 7.0."
// (https://github.com/typescript-eslint/typescript-eslint/issues/10940)
//
// Microsoft's own migration guidance for this exact transition
// (https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0)
// is to alias the root "typescript" package to the `@typescript/typescript6`
// compatibility shim so peer-dependent tooling keeps working. We can't take
// that route wholesale here: Next.js 16.3's own build-time type checking
// (`next build`) and our `npm run typecheck` script both specifically need
// the *real* typescript package (with its `bin/tsc`) resolvable as
// `typescript` at the project root — aliasing it away breaks both.
//
// Instead we install the real `typescript@^7` as the root "typescript"
// devDependency (satisfying Next.js + our own tsc), and separately install
// `@typescript/typescript6` (Microsoft's compat shim, re-exporting the 6.0
// API) as its own devDependency. This script then copies that shim into the
// node_modules/typescript directory nested inside eslint-config-next's own
// bundled typescript-eslint package. Node's module resolution walks up from
// the requiring file, so this nested copy shadows the real root "typescript"
// package for every module under that subtree (typescript-eslint, and all
// of @typescript-eslint/parser, eslint-plugin, typescript-estree, etc. that
// live inside it) — without touching typescript resolution anywhere else in
// the project.
//
// This is scoped as narrowly as possible (a plain fs.cpSync, not a symlink,
// so it survives Windows without elevated privileges) and re-runs on every
// `npm install` since eslint-config-next's nested node_modules is recreated
// each time. It's inherently coupled to eslint-config-next bundling its own
// typescript-eslint copy at this path; if that internal layout ever changes
// (or typescript-eslint ships real TS7 support and this becomes
// unnecessary), this script just warns and no-ops rather than failing the
// install.
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "@typescript", "typescript6");
const target = join(
  root,
  "node_modules",
  "eslint-config-next",
  "node_modules",
  "typescript-eslint",
  "node_modules",
  "typescript",
);

if (!existsSync(source)) {
  console.warn("@typescript/typescript6 not found in node_modules — skipping typescript-eslint TS7 compat shim");
  process.exit(0);
}

const typescriptEslintDir = dirname(target);
if (!existsSync(typescriptEslintDir)) {
  console.warn(
    "node_modules/eslint-config-next/node_modules/typescript-eslint not found (internal layout changed?) — skipping typescript-eslint TS7 compat shim",
  );
  process.exit(0);
}

cpSync(source, target, { recursive: true });
console.log("Linked @typescript/typescript6 into eslint-config-next's bundled typescript-eslint (TS7 compat, issue #125)");

// @typescript/typescript6 itself depends on `@typescript/old` (a real,
// unaliased TypeScript 6.x install) to implement the 6.0 API it re-exports.
// That nested dependency has its own `bin: { tsc: "./bin/tsc" }` — the exact
// same bin name as our real root "typescript" (7.x) devDependency. npm's
// top-level bin-linking only keeps one winner for a given name, and in
// practice it links whichever of the two it processes last, which is not
// guaranteed to be the root package. If it wins, `npx tsc` / a bare `tsc` on
// PATH silently runs TypeScript 6.0.3 instead of the real 7.x we upgraded
// to. `npm run typecheck` sidesteps this by invoking
// node_modules/typescript/bin/tsc directly, but we also repair the shared
// .bin/tsc(.cmd/.ps1) shims here so any other ambient `tsc` invocation
// (editor tooling, ad-hoc `npx tsc`) resolves to the real root compiler too.
// The sh/ps1 shims use forward slashes; the Windows .cmd shim uses backslashes.
const binDir = join(root, "node_modules", ".bin");
const replacements = [
  ["@typescript/old/bin/tsc", "typescript/bin/tsc"],
  ["@typescript\\old\\bin\\tsc", "typescript\\bin\\tsc"],
];
for (const shim of ["tsc", "tsc.cmd", "tsc.ps1"]) {
  const shimPath = join(binDir, shim);
  if (!existsSync(shimPath)) continue;
  let contents = readFileSync(shimPath, "utf8");
  let changed = false;
  for (const [stale, correct] of replacements) {
    if (contents.includes(stale)) {
      contents = contents.replaceAll(stale, correct);
      changed = true;
    }
  }
  if (!changed) continue;
  writeFileSync(shimPath, contents);
  console.log(`Repointed node_modules/.bin/${shim} from @typescript/old back to the real typescript@7 package`);
}
