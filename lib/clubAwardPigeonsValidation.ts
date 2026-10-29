// Pure validation for club_award_albums & club_award_pigeons (issue #378) —
// no HTTP/DB involved, directly unit-testable. Reuses pigeon_showcase's
// category/name/description/photoSource rules for pigeon fields and adds
// album-name validation.

import { validateRequiredTextField, type FieldValidationResult } from "@/lib/richTextValidation";
import {
  DESCRIPTION_HTML_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  PHOTO_SOURCE_OPTIONS,
  PIGEON_SHOWCASE_CATEGORIES,
  isPigeonShowcaseCategory,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
  validatePigeonShowcasePhotoSource,
  type PhotoSourceOption,
  type PigeonShowcaseCategory,
} from "@/lib/pigeonShowcaseValidation";

export {
  DESCRIPTION_HTML_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  PHOTO_SOURCE_OPTIONS,
  PIGEON_SHOWCASE_CATEGORIES,
  isPigeonShowcaseCategory,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
  validatePigeonShowcasePhotoSource,
  type FieldValidationResult,
  type PhotoSourceOption,
  type PigeonShowcaseCategory,
};

export const ALBUM_NAME_MAX = 100;

export function validateClubAwardAlbumName(name: string): FieldValidationResult {
  return validateRequiredTextField(name, {
    requiredError: "請輸入相簿名稱",
    tooLongError: `相簿名稱不能超過 ${ALBUM_NAME_MAX} 個字`,
    max: ALBUM_NAME_MAX,
  });
}
