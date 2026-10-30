import { describe, expect, it } from "vitest";
import { plainTextLength, validateRequiredTextField, validateRichTextField } from "./richTextValidation";
import { htmlToPlainText } from "./htmlText";

const rules = {
  emptyError: "請輸入內容",
  tooLongHtmlError: "內容過長",
  tooLongTextError: "內容不能超過 10 個字",
  htmlMax: 100,
  textMax: 10,
};

const requiredTextRules = {
  requiredError: "請輸入標題",
  tooLongError: "標題不能超過 10 個字",
  max: 10,
};

describe("validateRequiredTextField", () => {
  it("accepts non-blank text within the max length", () => {
    expect(validateRequiredTextField("標題", requiredTextRules)).toEqual({ ok: true });
  });

  it("rejects blank and whitespace-only input", () => {
    expect(validateRequiredTextField("", requiredTextRules)).toEqual({ ok: false, error: requiredTextRules.requiredError });
    expect(validateRequiredTextField("   ", requiredTextRules)).toEqual({
      ok: false,
      error: requiredTextRules.requiredError,
    });
  });

  it("accepts exactly at the max length and rejects one over", () => {
    expect(validateRequiredTextField("a".repeat(10), requiredTextRules)).toEqual({ ok: true });
    expect(validateRequiredTextField("a".repeat(11), requiredTextRules)).toEqual({
      ok: false,
      error: requiredTextRules.tooLongError,
    });
  });

  it("trims leading/trailing whitespace before checking length", () => {
    expect(validateRequiredTextField(`  ${"a".repeat(10)}  `, requiredTextRules)).toEqual({ ok: true });
  });
});

describe("validateRichTextField", () => {
  it("accepts text within both ceilings", () => {
    expect(validateRichTextField("<p>剛好</p>", rules)).toEqual({ ok: true });
  });

  it("rejects blank and whitespace-only input", () => {
    expect(validateRichTextField("", rules)).toEqual({ ok: false, error: rules.emptyError });
    expect(validateRichTextField("   ", rules)).toEqual({ ok: false, error: rules.emptyError });
  });

  it("reports markup with no visible text as empty rather than as valid", () => {
    expect(validateRichTextField("<p></p><br>", rules)).toEqual({ ok: false, error: rules.emptyError });
  });

  it("reports the raw-HTML ceiling separately from the visible-text cap", () => {
    // Bloated markup, but only a few visible characters — the author needs
    // to be told it's the markup that's the problem, not their word count.
    const bloated = `${"<b></b>".repeat(20)}abc`;
    expect(bloated.length).toBeGreaterThan(rules.htmlMax);
    expect(validateRichTextField(bloated, rules)).toEqual({ ok: false, error: rules.tooLongHtmlError });
  });

  it("caps on visible text, not on markup length", () => {
    expect(validateRichTextField("<b>1234567890</b>", rules)).toEqual({ ok: true });
    expect(validateRichTextField("<b>12345678901</b>", rules)).toEqual({
      ok: false,
      error: rules.tooLongTextError,
    });
  });
});

describe("plainTextLength", () => {
  it("ignores tags and decodes the entities authors actually produce", () => {
    expect(plainTextLength("<p>a&amp;b</p>")).toBe(3);
    expect(plainTextLength("&nbsp;&nbsp;x&nbsp;")).toBe(1);
  });

  // Issue #139 flagged this against htmlToPlainText as an accidental
  // divergence. It is deliberate, and this test exists so the difference is
  // a decision rather than a surprise: unifying them would raise the
  // measured length of every multi-paragraph document and could start
  // rejecting content that sits just under an existing 2000-character cap.
  it("drops tags outright, unlike htmlToPlainText which turns them into spaces", () => {
    const html = "<p>ab</p><p>cd</p>";

    expect(plainTextLength(html)).toBe(4);
    expect(htmlToPlainText(html)).toBe("ab cd");
    expect(htmlToPlainText(html).length).toBe(5);
  });
});
