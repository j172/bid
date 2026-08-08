// Issue #140 L-2: the /uploads/[...path] containment check. Pure path
// arithmetic (no filesystem access), so it's tested directly with no
// mocking — the reason it was lifted out of the route in the first place.
import { describe, expect, it } from "vitest";
import { join, sep } from "path";
import { resolveUploadPath, UPLOADS_ROOT } from "./uploads";

describe("resolveUploadPath", () => {
  it("resolves a normal nested upload path", () => {
    expect(resolveUploadPath(["listings", "42", "abc.webp"])).toBe(join(UPLOADS_ROOT, "listings", "42", "abc.webp"));
  });

  it("rejects ../ traversal out of the uploads root", () => {
    expect(resolveUploadPath(["..", ".env"])).toBeNull();
    expect(resolveUploadPath(["listings", "..", "..", "package.json"])).toBeNull();
    expect(resolveUploadPath(["listings", "42", "..", "..", "..", "etc", "passwd"])).toBeNull();
  });

  it("rejects a sibling directory that merely shares the root's prefix", () => {
    // The exact bug a bare `resolved.startsWith(UPLOADS_ROOT)` has: this
    // resolves to "<cwd>/uploads-backup/secrets.txt", which starts with
    // "<cwd>/uploads" as a string but is not inside it.
    const escaped = resolveUploadPath(["..", "uploads-backup", "secrets.txt"]);
    expect(escaped).toBeNull();
  });

  it("still allows a path that only looks like a prefix escape from inside the root", () => {
    // "<root>/uploads-backup" *is* inside the root — the separator check
    // must not over-reject it.
    expect(resolveUploadPath(["uploads-backup", "a.png"])).toBe(join(UPLOADS_ROOT, "uploads-backup", "a.png"));
  });

  it("allows the root itself through (the readFile call rejects it as a directory)", () => {
    expect(resolveUploadPath([])).toBe(UPLOADS_ROOT);
    expect(resolveUploadPath(["."])).toBe(UPLOADS_ROOT);
  });

  it("never returns a path outside the root for any segment shape", () => {
    const attempts = [
      ["..", "..", "..", "..", "windows", "system32"],
      ["....", "//", ".."],
      ["listings", "..", "..", "uploadsX", "a"],
    ];
    for (const segments of attempts) {
      const resolved = resolveUploadPath(segments);
      if (resolved !== null) {
        expect(resolved === UPLOADS_ROOT || resolved.startsWith(UPLOADS_ROOT + sep)).toBe(true);
      }
    }
  });
});
