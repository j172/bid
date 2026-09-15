// Pure validation for the products admin CRUD (issue #277) — see
// app/api/admin/products/route.ts / [id]/route.ts. No HTTP/DB involved, so
// it's directly unit-testable, same split as lib/listingValidation.ts.
//
// All three text fields are plain text (not TinyMCE-authored rich text like
// listings'/news'/pigeon_showcase's description fields — see this ticket's
// spec), so every one of them reuses richTextValidation's
// validateRequiredTextField rather than validateRichTextField.

import { validateRequiredTextField, type FieldValidationResult } from "@/lib/richTextValidation";

export const PRODUCT_TITLE_MAX = 255;
// Plain display text only (e.g. "NT$12,000") — never parsed as a number or
// used in any calculation; see db/init.sql's products.price_text comment.
export const PRODUCT_PRICE_TEXT_MAX = 100;
export const PRODUCT_DESCRIPTION_MAX = 2000;

export function validateProductTitle(title: string): FieldValidationResult {
  return validateRequiredTextField(title, {
    requiredError: "請輸入標題",
    tooLongError: `標題不能超過 ${PRODUCT_TITLE_MAX} 個字`,
    max: PRODUCT_TITLE_MAX,
  });
}

export function validateProductPriceText(priceText: string): FieldValidationResult {
  return validateRequiredTextField(priceText, {
    requiredError: "請輸入價格顯示文字",
    tooLongError: `價格顯示文字不能超過 ${PRODUCT_PRICE_TEXT_MAX} 個字`,
    max: PRODUCT_PRICE_TEXT_MAX,
  });
}

export function validateProductDescription(description: string): FieldValidationResult {
  return validateRequiredTextField(description, {
    requiredError: "請輸入商品簡介",
    tooLongError: `商品簡介不能超過 ${PRODUCT_DESCRIPTION_MAX} 個字`,
    max: PRODUCT_DESCRIPTION_MAX,
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
