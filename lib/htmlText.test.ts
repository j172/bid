import { describe, expect, it } from "vitest";
import { excerptHtml, htmlToPlainText } from "./htmlText";

describe("htmlToPlainText", () => {
  it("strips tags and collapses whitespace", () => {
    expect(htmlToPlainText("<p>血統  <strong>優良</strong></p>")).toBe("血統 優良");
  });

  it("decodes common HTML entities", () => {
    expect(htmlToPlainText("A &amp; B &lt;tag&gt; &quot;q&quot; &#39;s&#39;")).toBe(`A & B <tag> "q" 's'`);
  });

  it("returns an empty string for markup with no visible text", () => {
    expect(htmlToPlainText("<p><br></p>")).toBe("");
  });
});

describe("excerptHtml", () => {
  it("returns the full plain text untouched when under the limit", () => {
    expect(excerptHtml("<p>短簡介</p>", 20)).toBe("短簡介");
  });

  it("truncates and appends an ellipsis when over the limit", () => {
    const html = `<p>${"a".repeat(30)}</p>`;
    const result = excerptHtml(html, 10);
    expect(result).toBe(`${"a".repeat(10)}…`);
  });

  it("does not append an ellipsis on an exact-length fit", () => {
    const html = `<p>${"a".repeat(10)}</p>`;
    expect(excerptHtml(html, 10)).toBe("a".repeat(10));
  });
});
