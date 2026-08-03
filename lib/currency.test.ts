import { describe, expect, it } from "vitest";
import { convertFromTwd, currencyForLocale, formatConvertedApprox, formatDualPrice, formatNtd } from "./currency";

describe("currencyForLocale", () => {
  it("maps zh-TW to TWD", () => {
    expect(currencyForLocale("zh-TW")).toBe("TWD");
  });

  it("maps zh-CN to CNY", () => {
    expect(currencyForLocale("zh-CN")).toBe("CNY");
  });

  it("maps en to USD", () => {
    expect(currencyForLocale("en")).toBe("USD");
  });

  it("falls back to TWD for an unrecognized locale", () => {
    expect(currencyForLocale("fr")).toBe("TWD");
  });
});

describe("convertFromTwd", () => {
  it("divides by the rate and rounds to 2 decimals", () => {
    expect(convertFromTwd(10_000, 32.438)).toBeCloseTo(308.28, 2);
  });

  it("rounds rather than truncates", () => {
    // 100 / 3 = 33.3333... -> 33.33
    expect(convertFromTwd(100, 3)).toBe(33.33);
  });
});

describe("formatNtd", () => {
  it("formats with the NT$ symbol and thousands separators", () => {
    expect(formatNtd(10_000)).toBe("NT$10,000");
  });
});

describe("formatConvertedApprox", () => {
  it("returns null for TWD (no conversion needed)", () => {
    expect(formatConvertedApprox(10_000, "TWD", 32.438)).toBeNull();
  });

  it("returns null when no rate is available yet", () => {
    expect(formatConvertedApprox(10_000, "USD", null)).toBeNull();
  });

  it("returns the approximation string for USD", () => {
    expect(formatConvertedApprox(10_000, "USD", 31.5)).toBe("≈ $317.46");
  });
});

describe("formatDualPrice", () => {
  it("shows only the NTD amount for TWD (zh-TW, no conversion needed)", () => {
    expect(formatDualPrice(10_000, "TWD", 32.438)).toBe("NT$10,000");
  });

  it("shows only the NTD amount when no rate is available yet", () => {
    expect(formatDualPrice(10_000, "USD", null)).toBe("NT$10,000");
  });

  it("shows both amounts for USD with a rate", () => {
    expect(formatDualPrice(10_000, "USD", 31.5)).toBe("NT$10,000 (≈ $317.46)");
  });

  it("shows both amounts for CNY with a rate", () => {
    expect(formatDualPrice(10_000, "CNY", 4.687295)).toBe("NT$10,000 (≈ ¥2133.43)");
  });
});
