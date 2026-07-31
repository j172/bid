import { describe, expect, it } from "vitest";
import { validateSettlement } from "./settlement";

const valid = { account: "0912345678", amount: 5000 };

describe("validateSettlement", () => {
  it("accepts a well-formed settlement", () => {
    expect(validateSettlement(valid)).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only account", () => {
    expect(validateSettlement({ ...valid, account: "" }).ok).toBe(false);
    expect(validateSettlement({ ...valid, account: "   " }).ok).toBe(false);
  });

  it("rejects an account containing characters other than letters, digits, and dashes", () => {
    expect(validateSettlement({ ...valid, account: "0912 345 678" }).ok).toBe(false);
    expect(validateSettlement({ ...valid, account: "acct#123" }).ok).toBe(false);
  });

  it("accepts an account with dashes", () => {
    expect(validateSettlement({ ...valid, account: "812-1234-5678901" })).toEqual({ ok: true });
  });

  it("rejects an account shorter than 4 characters", () => {
    expect(validateSettlement({ ...valid, account: "123" }).ok).toBe(false);
  });

  it("accepts an account at exactly 4 characters", () => {
    expect(validateSettlement({ ...valid, account: "1234" })).toEqual({ ok: true });
  });

  it("rejects an account longer than 30 characters", () => {
    expect(validateSettlement({ ...valid, account: "1".repeat(31) }).ok).toBe(false);
  });

  it("accepts an account at exactly 30 characters", () => {
    expect(validateSettlement({ ...valid, account: "1".repeat(30) })).toEqual({ ok: true });
  });

  it("rejects a non-finite, zero, negative, or non-integer amount", () => {
    expect(validateSettlement({ ...valid, amount: NaN }).ok).toBe(false);
    expect(validateSettlement({ ...valid, amount: 0 }).ok).toBe(false);
    expect(validateSettlement({ ...valid, amount: -100 }).ok).toBe(false);
    expect(validateSettlement({ ...valid, amount: 100.5 }).ok).toBe(false);
  });

  it("accepts a positive integer amount", () => {
    expect(validateSettlement({ ...valid, amount: 1 })).toEqual({ ok: true });
  });
});
