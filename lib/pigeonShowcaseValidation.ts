// Pure validation for pigeon_showcase fields (issue #54) — no HTTP/DB
// involved, directly unit-testable, same split as lib/listingValidation.ts.

import { validateRequiredTextField, validateRichTextField, type FieldValidationResult } from "@/lib/richTextValidation";

// 'world_famous' (世界名鴿) added by issue #307, replacing the homepage's old
// "熱門成交排行" section with a curated world-famous-pigeons showcase fed by
// this same table/category system.
export const PIGEON_SHOWCASE_CATEGORIES = ["award", "imported", "representative", "world_famous"] as const;
export type PigeonShowcaseCategory = (typeof PIGEON_SHOWCASE_CATEGORIES)[number];

export const NAME_MAX = 100;
// Measured against plain text (HTML tags stripped) since the description is
// authored as rich text (TinyMCE) — same reasoning as
// lib/listingValidation.ts's DESCRIPTION_MAX.
export const DESCRIPTION_MAX = 2000;
// Generous raw-HTML ceiling purely against pathological markup, mirroring
// lib/listingValidation.ts's DESCRIPTION_HTML_MAX.
export const DESCRIPTION_HTML_MAX = 20_000;

export type { FieldValidationResult };

export function isPigeonShowcaseCategory(value: unknown): value is PigeonShowcaseCategory {
  return typeof value === "string" && (PIGEON_SHOWCASE_CATEGORIES as readonly string[]).includes(value);
}

export function validatePigeonShowcaseName(name: string): FieldValidationResult {
  return validateRequiredTextField(name, {
    requiredError: "請輸入名稱",
    tooLongError: `名稱不能超過 ${NAME_MAX} 個字`,
    max: NAME_MAX,
  });
}

export function validatePigeonShowcaseDescription(description: string): FieldValidationResult {
  return validateRichTextField(description, {
    emptyError: "請輸入簡介",
    tooLongHtmlError: "簡介內容過長",
    tooLongTextError: `簡介不能超過 ${DESCRIPTION_MAX} 個字`,
    htmlMax: DESCRIPTION_HTML_MAX,
    textMax: DESCRIPTION_MAX,
  });
}

export const PHOTO_SOURCE_OPTIONS = ["三豐攝影", "舍內自拍", "其他"] as const;
export type PhotoSourceOption = (typeof PHOTO_SOURCE_OPTIONS)[number];

export function validatePigeonShowcasePhotoSource(photoSource: string): FieldValidationResult {
  const trimmed = photoSource.trim();
  if (!trimmed) return { ok: true };
  if (trimmed.length > 100) {
    return { ok: false, error: "照片來源長度不能超過 100 個字" };
  }
  return { ok: true };
}
