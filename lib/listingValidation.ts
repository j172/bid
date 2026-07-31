// Pure validation for listing creation fields shared by both listing types
// (auction and fixed_price) — see app/api/admin/listings/route.ts. No HTTP/
// DB involved, so it's directly unit-testable (see listingValidation.test.ts).

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 2000;
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

export function validateDescription(description: string): FieldValidationResult {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "請輸入描述" };
  }
  if (trimmed.length > DESCRIPTION_MAX) {
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
