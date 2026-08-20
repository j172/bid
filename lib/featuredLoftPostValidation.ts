// Pure validation for featured_loft_posts fields (issue #176) — no HTTP/DB
// involved, directly unit-testable, same split as lib/newsValidation.ts /
// lib/pigeonShowcaseValidation.ts, which this mirrors field-for-field (this
// feature is explicitly modeled on 最新訊息).

import { validateRequiredTextField, validateRichTextField, type FieldValidationResult } from "@/lib/richTextValidation";

export const TITLE_MAX = 100;
// Measured against plain text (HTML tags stripped) since content is
// authored as rich text (TinyMCE) — same reasoning as lib/newsValidation.ts's
// CONTENT_MAX.
export const CONTENT_MAX = 2000;
// Generous raw-HTML ceiling purely against pathological markup, mirroring
// lib/newsValidation.ts's CONTENT_HTML_MAX.
export const CONTENT_HTML_MAX = 20_000;

export type { FieldValidationResult };

export function validateFeaturedLoftPostTitle(title: string): FieldValidationResult {
  return validateRequiredTextField(title, {
    requiredError: "請輸入標題",
    tooLongError: `標題不能超過 ${TITLE_MAX} 個字`,
    max: TITLE_MAX,
  });
}

export function validateFeaturedLoftPostContent(content: string): FieldValidationResult {
  return validateRichTextField(content, {
    emptyError: "請輸入內容",
    tooLongHtmlError: "內容過長",
    tooLongTextError: `內容不能超過 ${CONTENT_MAX} 個字`,
    htmlMax: CONTENT_HTML_MAX,
    textMax: CONTENT_MAX,
  });
}
