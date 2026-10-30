import { describe, expect, it } from "vitest";
import { convertFromTwd, currencyForLocale, formatConvertedApprox, formatDualPrice, formatNtd } from "./currency";

describe("currencyForLocale", () => {
  it("maps zh-TW to an empty array (no conversion needed)", () => {
    expect(currencyForLocale("zh-TW")).toEqual([]);
  });

  it("maps zh-CN to [CNY]", () => {
    expect(currencyForLocale("zh-CN")).toEqual(["CNY"]);
  });

  it("maps en to [USD, EUR]", () => {
    expect(currencyForLocale("en")).toEqual(["USD", "EUR"]);
  });

  it("falls back to an empty array for an unrecognized locale", () => {
    expect(currencyForLocale("fr")).toEqual([]);
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
  it("returns an empty array for an empty currency list (zh-TW, no conversion needed)", () => {
    expect(formatConvertedApprox(10_000, [])).toEqual([]);
  });

  it("returns an empty array when no rate is available yet", () => {
    expect(formatConvertedApprox(10_000, [{ currency: "USD", rate: null }])).toEqual([]);
  });

  it("returns the approximation string for a single currency (USD)", () => {
    expect(formatConvertedApprox(10_000, [{ currency: "USD", rate: 31.5 }])).toEqual(["≈ $317.46"]);
  });

  it("returns one approximation string per currency, in order", () => {
    expect(
      formatConvertedApprox(10_000, [
        { currency: "USD", rate: 31.5 },
        { currency: "EUR", rate: 34.02 },
      ]),
    ).toEqual(["≈ $317.46", "≈ €293.94"]);
  });

  // TWD can never be a *converted* currency (it's the base every price is
  // already stored in), so it's filtered out even if a caller passes one —
  // this guards the DisplayCurrency-typed entry point against a "≈ NT$"
  // line that would just restate the main price.
  it("never emits a line for TWD itself", () => {
    expect(formatConvertedApprox(10_000, [{ currency: "TWD", rate: 1 }, { currency: "USD", rate: 31.5 }])).toEqual([
      "≈ $317.46",
    ]);
  });

  it("drops a currency whose rate is null rather than showing a broken conversion", () => {
    expect(
      formatConvertedApprox(10_000, [
        { currency: "USD", rate: 31.5 },
        { currency: "EUR", rate: null },
      ]),
    ).toEqual(["≈ $317.46"]);
  });
});

describe("formatDualPrice", () => {
  it("shows only the NTD amount for an empty currency list (zh-TW, no conversion needed)", () => {
    expect(formatDualPrice(10_000, [])).toBe("NT$10,000");
  });

  it("shows only the NTD amount when no rate is available yet", () => {
    expect(formatDualPrice(10_000, [{ currency: "USD", rate: null }])).toBe("NT$10,000");
  });

  it("shows both amounts for a single currency (USD) with a rate", () => {
    expect(formatDualPrice(10_000, [{ currency: "USD", rate: 31.5 }])).toBe("NT$10,000 (≈ $317.46)");
  });

  it("shows both amounts for a single currency (CNY) with a rate", () => {
    expect(formatDualPrice(10_000, [{ currency: "CNY", rate: 4.687295 }])).toBe("NT$10,000 (≈ ¥2133.43)");
  });

  // Regression guard (issue #154): the single-currency call shape used to be
  // formatDualPrice(amountTwd, currency, rate) directly, producing this
  // exact string for zh-CN's CNY case. The new array-based signature must
  // still produce byte-for-byte the same output for that one-currency case.
  it("matches the exact pre-#154 single-currency output string", () => {
    expect(formatDualPrice(10_000, [{ currency: "CNY", rate: 4.687295 }])).toBe("NT$10,000 (≈ ¥2133.43)");
    expect(formatDualPrice(10_000, [{ currency: "USD", rate: 31.5 }])).toBe("NT$10,000 (≈ $317.46)");
  });

  it("joins two currencies with a slash inside the same parentheses", () => {
    expect(
      formatDualPrice(10_000, [
        { currency: "USD", rate: 31.5 },
        { currency: "EUR", rate: 34.02 },
      ]),
    ).toBe("NT$10,000 (≈ $317.46 / €293.94)");
  });

  it("never joins in TWD itself", () => {
    expect(formatDualPrice(10_000, [{ currency: "TWD", rate: 1 }, { currency: "USD", rate: 31.5 }])).toBe(
      "NT$10,000 (≈ $317.46)",
    );
  });

  it("omits a currency whose rate is null while still showing the other", () => {
    expect(
      formatDualPrice(10_000, [
        { currency: "USD", rate: 31.5 },
        { currency: "EUR", rate: null },
      ]),
    ).toBe("NT$10,000 (≈ $317.46)");
  });
});
