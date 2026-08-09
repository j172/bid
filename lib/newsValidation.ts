// Pure validation for news_posts fields (issue #56) — no HTTP/DB involved,
// directly unit-testable, same split as lib/pigeonShowcaseValidation.ts /
// lib/listingValidation.ts.

import { validateRichTextField, type FieldValidationResult } from "@/lib/richTextValidation";

export const TITLE_MAX = 100;
// Measured against plain text (HTML tags stripped) since content is
// authored as rich text (TinyMCE) — same reasoning as
// lib/pigeonShowcaseValidation.ts's DESCRIPTION_MAX.
export const CONTENT_MAX = 2000;
// Generous raw-HTML ceiling purely against pathological markup, mirroring
// lib/pigeonShowcaseValidation.ts's DESCRIPTION_HTML_MAX.
export const CONTENT_HTML_MAX = 20_000;

export type { FieldValidationResult };

export function validateNewsTitle(title: string): FieldValidationResult {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "請輸入標題" };
  }
  if (trimmed.length > TITLE_MAX) {
    return { ok: false, error: `標題不能超過 ${TITLE_MAX} 個字` };
  }
  return { ok: true };
}

export function validateNewsContent(content: string): FieldValidationResult {
  return validateRichTextField(content, {
    emptyError: "請輸入內容",
    tooLongHtmlError: "內容過長",
    tooLongTextError: `內容不能超過 ${CONTENT_MAX} 個字`,
    htmlMax: CONTENT_HTML_MAX,
    textMax: CONTENT_MAX,
  });
}
