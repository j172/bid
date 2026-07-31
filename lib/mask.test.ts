import { describe, expect, it } from "vitest";
import { maskDisplayName } from "./mask";

describe("maskDisplayName", () => {
  it("keeps the first character and masks the rest", () => {
    expect(maskDisplayName("王小明")).toBe("王**");
    expect(maskDisplayName("Alice")).toBe("A****");
  });

  it("returns the single character unmasked when there's nothing left to mask", () => {
    expect(maskDisplayName("王")).toBe("王");
    expect(maskDisplayName("A")).toBe("A");
  });

  it("falls back to a generic label for null (legacy accounts with no display name)", () => {
    expect(maskDisplayName(null)).toBe("匿名買家");
  });

  it("falls back to a generic label for an empty string", () => {
    expect(maskDisplayName("")).toBe("匿名買家");
  });
});
