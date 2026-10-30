import { describe, it, expect } from "vitest";
import { formatProductPriceText } from "./productPriceText";

describe("formatProductPriceText", () => {
  it("formats a pure numeric string with an NT$ prefix and thousand separators", () => {
    expect(formatProductPriceText("1200", "zh-TW")).toBe("NT$1,200");
    expect(formatProductPriceText("1200000", "zh-TW")).toBe("NT$1,200,000");
  });

  it("trims surrounding whitespace before formatting a pure numeric string", () => {
    expect(formatProductPriceText("  1200  ", "zh-TW")).toBe("NT$1,200");
  });

  it("leaves a string that already has an NT$ prefix unchanged", () => {
    expect(formatProductPriceText("NT$12,000", "zh-TW")).toBe("NT$12,000");
  });

  it("leaves non-numeric free text like 電洽 unchanged", () => {
    expect(formatProductPriceText("電洽", "zh-TW")).toBe("電洽");
  });

  it("leaves 面議 unchanged", () => {
    expect(formatProductPriceText("面議", "zh-TW")).toBe("面議");
  });

  it("leaves a string with decimals unchanged", () => {
    expect(formatProductPriceText("1200.50", "zh-TW")).toBe("1200.50");
  });

  it("leaves a string that already has commas unchanged", () => {
    expect(formatProductPriceText("1,200", "zh-TW")).toBe("1,200");
  });

  it("leaves an empty or whitespace-only string unchanged (passthrough)", () => {
    expect(formatProductPriceText("", "zh-TW")).toBe("");
    expect(formatProductPriceText("   ", "zh-TW")).toBe("   ");
  });
});
