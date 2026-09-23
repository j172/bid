// Regression test for issue #344 (A-1): on this project's production host,
// Node's global fetch() (undici) can throw an uncaught
// `RangeError: WebAssembly.instantiate(): Out of memory` on its first lazy
// WASM init under this host's LVE memory ceiling, crashing the whole
// process — see the header comments in lib/httpsRequest.ts,
// lib/exchangeRates.ts, lib/email.ts, and lib/turnstile.ts for the full
// history (issues #86, #104, #139, #344). Every server-side outbound HTTP
// call in this codebase must go through lib/httpsRequest.ts's
// httpsRequest() (node:https) instead of the global fetch().
//
// This test scans lib/**/*.ts and app/api/**/*.ts source text for a bare
// `fetch(` call and fails if one shows up outside the small, explicitly
// reviewed WHITELIST below (client-side "use client" hooks that run in the
// browser, where global fetch() is normal and safe — there's no LVE/WASM
// memory constraint on the visitor's own browser).
//
// Modeled on the equivalent tests/no-server-fetch.test.mjs in the sibling
// `health` project (not available in this checkout/repo — reimplemented
// fresh here for bid's file layout and test stack).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

// Files that legitimately call the browser's global fetch() from client
// code (each starts with "use client" and fetches one of this app's own
// relative API routes) — confirmed by reading each file, not guessed:
//   - lib/useListingCountdown.ts: polls `/api/listings/${id}/status` from
//     the browser to refresh a live countdown/price.
//   - lib/usePostJson.ts: shared "POST JSON to one of our own API routes"
//     hook used by client forms (issue #139 item 1).
// Both run in the visitor's browser, never on the server, so undici's
// WASM-OOM failure mode (a server-process crash) does not apply to them.
const WHITELIST = new Set<string>(["lib/useListingCountdown.ts", "lib/usePostJson.ts"]);

// Directories to scan, mirroring the issue's "lib/**/*.ts and
// app/api/**/*.ts" scope.
const SCAN_DIRS = ["lib", join("app", "api")];

function listTsFiles(dir: string): string[] {
  const absoluteDir = join(ROOT, dir);
  let entries: string[];
  try {
    entries = readdirSync(absoluteDir);
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = join(absoluteDir, entry);
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      files.push(...listTsFiles(relative(ROOT, absolutePath)));
    } else if (/\.tsx?$/.test(entry)) {
      files.push(relative(ROOT, absolutePath));
    }
  }
  return files;
}

// Strips comments before matching, so the many explanatory comments in this
// codebase that legitimately mention "fetch()" while explaining why the
// *real* code next to them uses node:https instead (e.g.
// lib/httpsRequest.ts's own header) don't trip this rule.
//
// Deliberately simple rather than a full tokenizer: block comments
// (/* ... */, including JSDoc) are removed first, then anything from the
// first "//" to end of line on each remaining line is removed. This
// codebase never puts a real fetch(...) call after a "//" earlier on the
// same line (e.g. inside a URL string), so the naive per-line cut is safe
// here; a file that did would need a smarter stripper.
function stripComments(source: string): string {
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlockComments
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
}

// A bare global fetch(...) call: "fetch(" not qualified by a preceding "."
// (so "window.fetch(" or "someClient.fetch(" wouldn't false-positive) and
// not preceded by an identifier character (so "httpsRequestMock" or a
// hypothetical "refetch(" helper wouldn't either).
const BARE_FETCH_CALL = /(?<![.\w])fetch\(/;

describe("no bare server-side fetch() (issue #344)", () => {
  const candidateFiles = SCAN_DIRS.flatMap(listTsFiles)
    // Test files exercise mocks (e.g. `vi.spyOn(globalThis, "fetch")`,
    // `vi.mock("@/lib/httpsRequest", ...)`) rather than making real
    // outbound calls; they're not the production server code this rule
    // guards, so they're out of scope the same way health's equivalent
    // test excludes its own *.test.mjs files.
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .filter((file) => !WHITELIST.has(file.split(sep).join("/")));

  it("found at least one file to scan (sanity check the globs above)", () => {
    expect(candidateFiles.length).toBeGreaterThan(0);
  });

  it.each(candidateFiles)("%s does not call the global fetch()", (file) => {
    const source = readFileSync(join(ROOT, file), "utf8");
    const withoutComments = stripComments(source);
    expect(BARE_FETCH_CALL.test(withoutComments)).toBe(false);
  });
});
