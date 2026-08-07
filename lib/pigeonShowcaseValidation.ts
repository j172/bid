// Pure validation for pigeon_showcase fields (issue #54) — no HTTP/DB
// involved, directly unit-testable, same split as lib/listingValidation.ts.

import { descriptionPlainTextLength } from "@/lib/listingValidation";

export const PIGEON_SHOWCASE_CATEGORIES = ["award", "imported"] as const;
export type PigeonShowcaseCategory = (typeof PIGEON_SHOWCASE_CATEGORIES)[number];

export const NAME_MAX = 100;
// Measured against plain text (HTML tags stripped) since the description is
// authored as rich text (TinyMCE) — same reasoning as
// lib/listingValidation.ts's DESCRIPTION_MAX.
export const DESCRIPTION_MAX = 2000;
// Generous raw-HTML ceiling purely against pathological markup, mirroring
// lib/listingValidation.ts's DESCRIPTION_HTML_MAX.
export const DESCRIPTION_HTML_MAX = 20_000;

export type FieldValidationResult = { ok: true } | { ok: false; error: string };

export function isPigeonShowcaseCategory(value: unknown): value is PigeonShowcaseCategory {
  return typeof value === "string" && (PIGEON_SHOWCASE_CATEGORIES as readonly string[]).includes(value);
}

export function validatePigeonShowcaseName(name: string): FieldValidationResult {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "請輸入名稱" };
  }
  if (trimmed.length > NAME_MAX) {
    return { ok: false, error: `名稱不能超過 ${NAME_MAX} 個字` };
  }
  return { ok: true };
}

export function validatePigeonShowcaseDescription(description: string): FieldValidationResult {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "請輸入簡介" };
  }
  if (trimmed.length > DESCRIPTION_HTML_MAX) {
    return { ok: false, error: "簡介內容過長" };
  }
  const plainTextLength = descriptionPlainTextLength(trimmed);
  if (plainTextLength === 0) {
    return { ok: false, error: "請輸入簡介" };
  }
  if (plainTextLength > DESCRIPTION_MAX) {
    return { ok: false, error: `簡介不能超過 ${DESCRIPTION_MAX} 個字` };
  }
  return { ok: true };
}
