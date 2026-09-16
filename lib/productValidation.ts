// Pure validation for the products admin CRUD (issue #277) — see
// app/api/admin/products/route.ts / [id]/route.ts. No HTTP/DB involved, so
// it's directly unit-testable, same split as lib/listingValidation.ts.
//
// title/priceText stay plain text, validated via richTextValidation's
// validateRequiredTextField. description switched to TinyMCE-authored rich
// text in issue #286 (same DescriptionEditor listings use, mainly to gain
// its "插入 YouTube 影片" button) and now goes through validateRichTextField
// instead — byte-for-byte the same four-check shape lib/listingValidation.ts
// already uses for listings' description.

import { validateRequiredTextField, validateRichTextField, type FieldValidationResult } from "@/lib/richTextValidation";

export const PRODUCT_TITLE_MAX = 255;
// Plain display text only (e.g. "NT$12,000") — never parsed as a number or
// used in any calculation; see db/init.sql's products.price_text comment.
export const PRODUCT_PRICE_TEXT_MAX = 100;
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

export function validateProductPriceText(priceText: string): FieldValidationResult {
  return validateRequiredTextField(priceText, {
    requiredError: "請輸入價格顯示文字",
    tooLongError: `價格顯示文字不能超過 ${PRODUCT_PRICE_TEXT_MAX} 個字`,
    max: PRODUCT_PRICE_TEXT_MAX,
  });
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
