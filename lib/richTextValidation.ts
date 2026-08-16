// Shared pieces of lib/listingValidation.ts / lib/newsValidation.ts /
// lib/pigeonShowcaseValidation.ts's field validators (issue #139 M9): each of
// the three declared its own copy of FieldValidationResult and re-typed the
// same two check shapes —
//
//   - a plain required-text field (a listing's 標題, a news post's 標題, a
//     pigeon showcase entry's 名稱): trim, reject blank, reject over a max
//     length — see validateRequiredTextField.
//   - a TinyMCE-authored rich-text field (a listing's 描述, a news post's
//     內容, a pigeon showcase entry's 簡介): the same four checks in the same
//     order — see validateRichTextField.
//
// Only the wording and the numeric ceilings ever differed between the three
// files' copies.
//
// Pure (no HTTP/DB), and imported by client editor components as well as API
// routes, so it must stay dependency-free.

export type FieldValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Length of the *visible* text in a rich-text HTML string, used for the
 * user-facing character counters and caps — markup shouldn't eat into an
 * author's character budget.
 *
 * Rough (regex-based, not a real HTML parser) on purpose: this isn't a
 * security boundary — lib/sanitizeDescriptionHtml.ts is — it just has to
 * behave identically in the browser and in the Node API route without
 * pulling in a DOM implementation on either side.
 *
 * Deliberately NOT the same as htmlToPlainText() in lib/htmlText.ts, despite
 * the near-identical body (issue #139 flagged the two as silently diverged).
 * That one replaces each tag with a space and then collapses whitespace, so
 * it can produce readable excerpt *text*; this one drops tags outright, so
 * `<p>ab</p><p>cd</p>` measures 4 here and 5 there. Unifying them would
 * quietly raise the measured length of every multi-paragraph document and
 * could start rejecting content that sits just under an existing cap, so the
 * two stay separate on purpose: excerpts read better with the spaces, and
 * character counts stay backwards-compatible without them.
 */
export function plainTextLength(html: string): number {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim().length;
}

export interface RequiredTextFieldRules {
  /** Shown when the field is blank (after trimming). */
  requiredError: string;
  /** Shown when the trimmed value is longer than `max`. */
  tooLongError: string;
  max: number;
}

/**
 * The two checks every plain required-text field runs, in order: reject
 * blank first, then reject over-length. Trims before both checks, and the
 * `ok: true` case is the trimmed length — same "leading/trailing whitespace
 * doesn't count" rule validateRichTextField applies via plainTextLength.
 */
export function validateRequiredTextField(value: string, rules: RequiredTextFieldRules): FieldValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: rules.requiredError };
  }
  if (trimmed.length > rules.max) {
    return { ok: false, error: rules.tooLongError };
  }
  return { ok: true };
}

export interface RichTextFieldRules {
  /** Shown when the field is blank, or when it contains markup but no visible text. */
  emptyError: string;
  /** Shown when the raw HTML blows past htmlMax. */
  tooLongHtmlError: string;
  /** Shown when the visible text blows past textMax. */
  tooLongTextError: string;
  /**
   * Generous ceiling on the raw HTML itself, purely to stop pathological
   * markup (e.g. hundreds of empty nested tags) from bloating storage — not
   * a limit authors are meant to hit, so it isn't surfaced as a counter.
   */
  htmlMax: number;
  /** The real, user-facing cap, measured against plainTextLength. */
  textMax: number;
}

/**
 * The four checks every rich-text field runs, in the order that produces the
 * most useful message: blank first, then the storage ceiling, then
 * markup-with-no-text (which reads as blank to a human), then the visible
 * character cap.
 */
export function validateRichTextField(value: string, rules: RichTextFieldRules): FieldValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: rules.emptyError };
  }
  if (trimmed.length > rules.htmlMax) {
    return { ok: false, error: rules.tooLongHtmlError };
  }
  const textLength = plainTextLength(trimmed);
  if (textLength === 0) {
    return { ok: false, error: rules.emptyError };
  }
  if (textLength > rules.textMax) {
    return { ok: false, error: rules.tooLongTextError };
  }
  return { ok: true };
}
