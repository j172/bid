// Pure validation for listing creation fields shared by both listing types
// (auction and fixed_price) — see app/api/admin/listings/route.ts. No HTTP/
// DB involved, so it's directly unit-testable (see listingValidation.test.ts).

export const TITLE_MAX = 100;
// Measured against the *plain text* of the description (HTML tags stripped
// — see descriptionPlainTextLength) since the description is now authored
// as rich text (TinyMCE) rather than a plain textarea, and markup alone
// shouldn't eat into a seller's character budget.
export const DESCRIPTION_MAX = 2000;
// A separate, deliberately generous ceiling on the raw HTML itself, purely
// to stop pathological markup (e.g. hundreds of empty nested tags) from
// bloating storage — not meant to be a limit sellers ever bump into in
// normal use, so it isn't surfaced as a counter in the UI.
export const DESCRIPTION_HTML_MAX = 20_000;
export const PRICE_MAX = 10_000_000;
export const ENDS_AT_MAX_DAYS = 90;

export type FieldValidationResult = { ok: true } | { ok: false; error: string };

export function validateTitle(title: string): FieldValidationResult {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "請輸入標題" };
  }
  if (trimmed.length > TITLE_MAX) {
    return { ok: false, error: `標題不能超過 ${TITLE_MAX} 個字` };
  }
  return { ok: true };
}

// Rough (regex-based, not a real HTML parser) tag strip used only to measure
// how much *visible* text a description HTML string contains. This isn't a
// security boundary — sanitizeDescriptionHtml (lib/sanitizeDescriptionHtml.ts)
// handles that — it just needs to work identically in the browser and in the
// Node API route without pulling in a DOM implementation on either side.
export function descriptionPlainTextLength(html: string): number {
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

export function validateDescription(description: string): FieldValidationResult {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "請輸入描述" };
  }
  if (trimmed.length > DESCRIPTION_HTML_MAX) {
    return { ok: false, error: "描述內容過長" };
  }
  const plainTextLength = descriptionPlainTextLength(trimmed);
  if (plainTextLength === 0) {
    return { ok: false, error: "請輸入描述" };
  }
  if (plainTextLength > DESCRIPTION_MAX) {
    return { ok: false, error: `描述不能超過 ${DESCRIPTION_MAX} 個字` };
  }
  return { ok: true };
}

export function validatePrice(value: number, label: string): FieldValidationResult {
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `${label}必須是正數` };
  }
  if (value > PRICE_MAX) {
    return { ok: false, error: `${label}不能超過 ${PRICE_MAX}` };
  }
  return { ok: true };
}

export function validateEndsAt(endsAt: Date): FieldValidationResult {
  if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
    return { ok: false, error: "結標時間必須是有效且在未來的時間" };
  }
  const maxMs = ENDS_AT_MAX_DAYS * 24 * 60 * 60 * 1000;
  if (endsAt.getTime() > Date.now() + maxMs) {
    return { ok: false, error: `結標時間最遠只能設定在 ${ENDS_AT_MAX_DAYS} 天後` };
  }
  return { ok: true };
}

export function validateStockQuantity(value: number): FieldValidationResult {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return { ok: false, error: "庫存數量必須是正整數" };
  }
  return { ok: true };
}

// Unlike validateStockQuantity (creation, must start above zero), editing a
// listing's remaining stock down to exactly 0 is a valid way to mark it
// temporarily sold out without deleting or cancelling it.
export function validateStockRemaining(value: number): FieldValidationResult {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return { ok: false, error: "庫存數量必須是不小於 0 的整數" };
  }
  return { ok: true };
}
