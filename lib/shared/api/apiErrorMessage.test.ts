import { describe, expect, it, vi } from "vitest";
import { resolveApiErrorMessage, type ErrorCodeTranslator } from "./apiErrorMessage";

function fakeTranslator(messages: Record<string, string>): ErrorCodeTranslator {
  const translate = vi.fn((key: string, values?: Record<string, string | number>) => {
    const message = messages[key] ?? `errors.${key}`;
    if (!values) return message;
    return Object.entries(values).reduce((acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)), message);
  }) as unknown as ErrorCodeTranslator;
  translate.has = (key: string) => key in messages;
  return translate;
}

describe("resolveApiErrorMessage", () => {
  it("falls back to the caller's default copy when the response carried no error code", () => {
    const t = fakeTranslator({ BID_TOO_LOW: "太低" });
    expect(resolveApiErrorMessage(undefined, t, "發生錯誤")).toBe("發生錯誤");
    expect(resolveApiErrorMessage(null, t, "發生錯誤")).toBe("發生錯誤");
    expect(resolveApiErrorMessage("", t, "發生錯誤")).toBe("發生錯誤");
  });

  it("translates a known error code", () => {
    const t = fakeTranslator({ BID_TOO_LOW: "出價太低" });
    expect(resolveApiErrorMessage("BID_TOO_LOW", t, "發生錯誤")).toBe("出價太低");
  });

  it("interpolates values into the translated message", () => {
    const t = fakeTranslator({ BID_TOO_LOW: "至少要出 {minimum}" });
    expect(resolveApiErrorMessage("BID_TOO_LOW", t, "發生錯誤", { minimum: 1200 })).toBe("至少要出 1200");
  });

  it("falls back to the default copy for a code with no message, never the raw key path", () => {
    const t = fakeTranslator({ BID_TOO_LOW: "出價太低" });
    expect(resolveApiErrorMessage("PROVIDER_ERROR", t, "訂閱失敗")).toBe("訂閱失敗");
  });
});
