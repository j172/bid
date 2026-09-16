// Pure validation for the products admin CRUD (issue #277; price/stock
// fields added by issue #298) — see app/api/admin/products/route.ts /
// [id]/route.ts. No HTTP/DB involved, so it's directly unit-testable, same
// split as lib/listingValidation.ts.
//
// title stays plain text, validated via richTextValidation's
// validateRequiredTextField. description switched to TinyMCE-authored rich
// text in issue #286 (same DescriptionEditor listings use, mainly to gain
// its "插入 YouTube 影片" button) and now goes through validateRichTextField
// instead — byte-for-byte the same four-check shape lib/listingValidation.ts
// already uses for listings' description.
//
// price/stockQuantity/stockRemaining (issue #298) are byte-for-byte the same
// validation shape as lib/listingValidation.ts's validatePrice/
// validatePriceOrCallForPrice/validateStockQuantity/validateStockRemaining —
// kept as an independent copy here (not imported from that module) since
// this ticket's explicit scope is "products only, never touch listings".
// price_text is no longer a free-text admin input (see lib/products.ts's
// derivePriceText) so validateProductPriceText/PRODUCT_PRICE_TEXT_MAX were
// removed along with the admin form field that used to collect it.

import { validateRequiredTextField, validateRichTextField, type FieldValidationResult } from "@/lib/richTextValidation";

export const PRODUCT_TITLE_MAX = 255;
export const PRODUCT_PRICE_MAX = 10_000_000;
// Measured against the *plain text* of the description (HTML tags stripped)
// since issue #286 switched authoring to rich text (TinyMCE) — same reasoning
// as lib/listingValidation.ts's DESCRIPTION_MAX.
export const PRODUCT_DESCRIPTION_MAX = 2000;
// Generous raw-HTML ceiling, purely to stop pathological markup from
// bloating storage — not a limit admins are meant to hit in normal use, so
// it isn't surfaced as a counter. Same value/reasoning as
// lib/listingValidation.ts's DESCRIPTION_HTML_MAX.
export const PRODUCT_DESCRIPTION_HTML_MAX = 20_000;

export function validateProductTitle(title: string): FieldValidationResult {
  return validateRequiredTextField(title, {
    requiredError: "請輸入標題",
    tooLongError: `標題不能超過 ${PRODUCT_TITLE_MAX} 個字`,
    max: PRODUCT_TITLE_MAX,
  });
}

export function validateProductPrice(value: number, label = "價格"): FieldValidationResult {
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: `${label}必須是正數` };
  }
  if (value > PRODUCT_PRICE_MAX) {
    return { ok: false, error: `${label}不能超過 ${PRODUCT_PRICE_MAX}` };
  }
  return { ok: true };
}

// 電洽 (call for price, issue #298 — mirrors listings' own callForPrice,
// issue #266): the admin checks a box instead of filling in a price, and
// price validation is skipped entirely in that case.
export function validateProductPriceOrCallForPrice(callForPrice: boolean, value: number): FieldValidationResult {
  if (callForPrice) {
    return { ok: true };
  }
  return validateProductPrice(value);
}

// Creation only, must start above zero — mirrors
// lib/listingValidation.ts's validateStockQuantity. Skipped entirely for
// 電洽 products (they're never sold online, so a stock count has no
// purpose) — unlike listings, which always requires one regardless of
// callForPrice; products deliberately allows leaving it out instead, so an
// admin doesn't have to invent a meaningless number for a pure display item.
export function validateProductStockQuantity(value: number, callForPrice: boolean): FieldValidationResult {
  if (callForPrice) {
    return { ok: true };
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return { ok: false, error: "庫存數量必須是正整數" };
  }
  return { ok: true };
}

// Editing a product's remaining stock down to exactly 0 is a valid way to
// mark it temporarily sold out without deactivating it — same "can reach
// zero, unlike creation" distinction as lib/listingValidation.ts's
// validateStockRemaining vs validateStockQuantity.
export function validateProductStockRemaining(value: number, callForPrice: boolean): FieldValidationResult {
  if (callForPrice) {
    return { ok: true };
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return { ok: false, error: "庫存數量必須是不小於 0 的整數" };
  }
  return { ok: true };
}

export function validateProductDescription(description: string): FieldValidationResult {
  return validateRichTextField(description, {
    emptyError: "請輸入商品簡介",
    tooLongHtmlError: "商品簡介內容過長",
    tooLongTextError: `商品簡介不能超過 ${PRODUCT_DESCRIPTION_MAX} 個字`,
    htmlMax: PRODUCT_DESCRIPTION_HTML_MAX,
    textMax: PRODUCT_DESCRIPTION_MAX,
  });
}

// Shared by the create and edit routes — same "omit for end-of-list" /
// "non-negative integer" rule as homepage_sections/homepage_videos'
// inline sortOrder checks (see e.g. lib/homepageVideos.ts's
// validateSortOrder), just exported here since both product routes need it.
export function validateProductSortOrder(sortOrder: number | undefined): FieldValidationResult {
  if (sortOrder !== undefined && (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0)) {
    return { ok: false, error: "排序必須是不小於 0 的整數" };
  }
  return { ok: true };
}
