import { describe, expect, it } from "vitest";
import { resolvePurchase } from "./purchase";

describe("resolvePurchase", () => {
  it("accepts a valid quantity within stock", () => {
    expect(resolvePurchase({ status: "open", stockRemaining: 5 }, 3)).toEqual({ ok: true });
  });

  it("accepts buying the exact remaining stock", () => {
    expect(resolvePurchase({ status: "open", stockRemaining: 5 }, 5)).toEqual({ ok: true });
  });

  it("rejects a listing that isn't open", () => {
    const result = resolvePurchase({ status: "cancelled", stockRemaining: 5 }, 1);
    expect(result.ok).toBe(false);
  });

  it("rejects non-finite, zero, negative, or non-integer quantities", () => {
    const base = { status: "open", stockRemaining: 5 };
    expect(resolvePurchase(base, NaN).ok).toBe(false);
    expect(resolvePurchase(base, 0).ok).toBe(false);
    expect(resolvePurchase(base, -1).ok).toBe(false);
    expect(resolvePurchase(base, 1.5).ok).toBe(false);
  });

  it("rejects a quantity exceeding remaining stock", () => {
    const result = resolvePurchase({ status: "open", stockRemaining: 2 }, 3);
    expect(result.ok).toBe(false);
  });

  it("rejects any purchase when stock is already exhausted", () => {
    const result = resolvePurchase({ status: "open", stockRemaining: 0 }, 1);
    expect(result.ok).toBe(false);
  });
});
