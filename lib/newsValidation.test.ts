import { describe, expect, it } from "vitest";
import { CONTENT_HTML_MAX, CONTENT_MAX, TITLE_MAX, validateNewsContent, validateNewsTitle } from "./newsValidation";

describe("validateNewsTitle", () => {
  it("accepts a normal title", () => {
    expect(validateNewsTitle("公告：本週競標時間異動")).toEqual({ ok: true });
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(validateNewsTitle("").ok).toBe(false);
    expect(validateNewsTitle("   ").ok).toBe(false);
  });

  it("rejects a title over the max length", () => {
    expect(validateNewsTitle("a".repeat(TITLE_MAX + 1)).ok).toBe(false);
  });

  it("accepts a title at exactly the max length", () => {
    expect(validateNewsTitle("a".repeat(TITLE_MAX))).toEqual({ ok: true });
  });
});

describe("validateNewsContent", () => {
  it("accepts normal content", () => {
    expect(validateNewsContent("<p>本週競標時間調整為晚上八點</p>")).toEqual({ ok: true });
  });

  it("rejects empty content", () => {
    expect(validateNewsContent("").ok).toBe(false);
  });

  it("rejects markup-only content with no visible text", () => {
    expect(validateNewsContent("<p><br></p>").ok).toBe(false);
  });

  it("measures against plain text, not raw HTML length", () => {
    const html = `<p>${"a".repeat(CONTENT_MAX)}</p>`;
    expect(validateNewsContent(html)).toEqual({ ok: true });
  });

  it("rejects plain text over CONTENT_MAX", () => {
    expect(validateNewsContent("a".repeat(CONTENT_MAX + 1)).ok).toBe(false);
  });

  it("rejects raw HTML over CONTENT_HTML_MAX even if plain text is short", () => {
    const html = `<p style="${"x".repeat(CONTENT_HTML_MAX)}">A</p>`;
    expect(validateNewsContent(html)).toEqual({ ok: false, error: "內容過長" });
  });
});
