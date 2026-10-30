import { describe, expect, it } from "vitest";
import { DEFAULT_GLOBAL_ERROR_LOCALE, detectGlobalErrorLocale } from "./globalErrorCopy";

describe("detectGlobalErrorLocale", () => {
  it("matches zh-TW for Traditional/Hant-flavored Chinese", () => {
    expect(detectGlobalErrorLocale(["zh-TW"])).toBe("zh-TW");
    expect(detectGlobalErrorLocale(["zh-Hant-TW"])).toBe("zh-TW");
    expect(detectGlobalErrorLocale(["zh-HK"])).toBe("zh-TW");
  });

  it("matches zh-CN for Simplified/Hans-flavored Chinese", () => {
    expect(detectGlobalErrorLocale(["zh-CN"])).toBe("zh-CN");
    expect(detectGlobalErrorLocale(["zh-Hans-CN"])).toBe("zh-CN");
    expect(detectGlobalErrorLocale(["zh-SG"])).toBe("zh-CN");
  });

  it("matches en for English", () => {
    expect(detectGlobalErrorLocale(["en-US"])).toBe("en");
    expect(detectGlobalErrorLocale(["en"])).toBe("en");
  });

  it("prefers an earlier zh entry over a later en entry", () => {
    expect(detectGlobalErrorLocale(["zh-CN", "en-US"])).toBe("zh-CN");
  });

  it("falls back to the site default for unsupported languages", () => {
    expect(detectGlobalErrorLocale(["fr-FR", "de-DE"])).toBe(DEFAULT_GLOBAL_ERROR_LOCALE);
  });

  it("falls back to the site default when nothing is provided", () => {
    expect(detectGlobalErrorLocale(undefined)).toBe(DEFAULT_GLOBAL_ERROR_LOCALE);
    expect(detectGlobalErrorLocale(null)).toBe(DEFAULT_GLOBAL_ERROR_LOCALE);
    expect(detectGlobalErrorLocale([])).toBe(DEFAULT_GLOBAL_ERROR_LOCALE);
  });
});
