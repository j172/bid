// The two helpers issue #139 M2 factored out of the four
// news/pigeon-showcase create+edit routes, which each spelled out the same
// "turn a save failure into a 400" / "delete the just-uploaded file when the
// row never got written" logic. Only these two are covered here — the rest of
// lib/uploads.ts is filesystem I/O.

import { describe, expect, it, vi } from "vitest";
import { join, sep } from "path";
import { saveImageOrError, withImageRollback, resolveUploadPath, UPLOADS_ROOT } from "./uploads";

describe("saveImageOrError", () => {
  it("returns the saved file name on success", async () => {
    await expect(saveImageOrError(async () => "abc.webp")).resolves.toEqual({
      ok: true,
      fileName: "abc.webp",
    });
  });

  it("turns a thrown Error into its message (what the routes answer 400 with)", async () => {
    const result = await saveImageOrError(async () => {
      throw new Error("不支援的圖片格式：image/tiff");
    });

    expect(result).toEqual({ ok: false, error: "不支援的圖片格式：image/tiff" });
  });

  it("falls back to a generic message for a non-Error throw", async () => {
    const result = await saveImageOrError(async () => {
      throw "boom";
    });

    expect(result).toEqual({ ok: false, error: "圖片上傳失敗" });
  });
});

describe("withImageRollback", () => {
  it("returns the write's outcome untouched and skips rollback on success", async () => {
    const rollback = vi.fn(async () => {});

    const result = await withImageRollback(async () => ({ ok: true as const, id: 12 }), rollback);

    expect(result).toEqual({ ok: true, id: 12 });
    expect(rollback).not.toHaveBeenCalled();
  });

  it("runs the rollback when the write reports ok:false, still returning its outcome", async () => {
    const rollback = vi.fn(async () => {});

    const result = await withImageRollback(
      async () => ({ ok: false as const, error: "找不到這則訊息" }),
      rollback,
    );

    expect(result).toEqual({ ok: false, error: "找不到這則訊息" });
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("awaits the rollback before returning, so the file is gone by the time the route responds", async () => {
    const order: string[] = [];
    const rollback = async () => {
      await Promise.resolve();
      order.push("rollback");
    };

    await withImageRollback(async () => {
      order.push("write");
      return { ok: false as const };
    }, rollback);
    order.push("returned");

    expect(order).toEqual(["write", "rollback", "returned"]);
  });
});

// Issue #140 L-2: the /uploads/[...path] containment check. Pure path
// arithmetic (no filesystem access), so it's tested directly with no
// mocking — the reason it was lifted out of the route in the first place.
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
