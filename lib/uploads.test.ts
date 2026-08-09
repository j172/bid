// The two helpers issue #139 M2 factored out of the four
// news/pigeon-showcase create+edit routes, which each spelled out the same
// "turn a save failure into a 400" / "delete the just-uploaded file when the
// row never got written" logic. Only these two are covered here — the rest of
// lib/uploads.ts is filesystem I/O.

import { describe, expect, it, vi } from "vitest";
import { saveImageOrError, withImageRollback } from "./uploads";

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
