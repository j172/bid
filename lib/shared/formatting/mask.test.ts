import { describe, expect, it } from "vitest";
import { maskDisplayName } from "./mask";

const ANONYMOUS = "匿名買家";

describe("maskDisplayName", () => {
  it("keeps the first character and masks the rest", () => {
    expect(maskDisplayName("王小明", ANONYMOUS)).toBe("王**");
    expect(maskDisplayName("Alice", ANONYMOUS)).toBe("A****");
  });

  it("returns the single character unmasked when there's nothing left to mask", () => {
    expect(maskDisplayName("王", ANONYMOUS)).toBe("王");
    expect(maskDisplayName("A", ANONYMOUS)).toBe("A");
  });

  it("falls back to the given label for null (legacy accounts with no display name)", () => {
    expect(maskDisplayName(null, ANONYMOUS)).toBe(ANONYMOUS);
  });

  it("falls back to the given label for an empty string", () => {
    expect(maskDisplayName("", ANONYMOUS)).toBe(ANONYMOUS);
  });
});
