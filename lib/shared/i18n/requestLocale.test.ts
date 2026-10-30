import { describe, expect, it } from "vitest";
import { resolveRequestLocale } from "./requestLocale";

describe("resolveRequestLocale", () => {
  it("passes through a supported locale from the body", () => {
    expect(resolveRequestLocale({ locale: "en" })).toBe("en");
    expect(resolveRequestLocale({ locale: "zh-CN" })).toBe("zh-CN");
  });

  it("falls back to the default locale when the body has no locale", () => {
    expect(resolveRequestLocale({})).toBe("zh-TW");
  });

  it("falls back to the default locale when body is null (unparseable JSON)", () => {
    expect(resolveRequestLocale(null)).toBe("zh-TW");
  });

  it("falls back to the default locale for an unsupported locale value", () => {
    expect(resolveRequestLocale({ locale: "fr" })).toBe("zh-TW");
  });

  it("falls back to the default locale for a non-string locale value", () => {
    expect(resolveRequestLocale({ locale: 123 })).toBe("zh-TW");
  });
});
