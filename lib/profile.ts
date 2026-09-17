// Pure validation for the account profile fields (display name, phone,
// address, LINE ID) — required at registration and editable later via
// /account. No HTTP/DB involved, so it's directly unit-testable (see
// profile.test.ts).
//
// lineId (issue #304) follows LINE's own official ID rules (letters, digits,
// '.', '_', '-', 4-20 characters) — required at registration so the seller
// has a direct contact channel for every buyer, and re-validated here for
// /account edits too (see app/api/account/profile/route.ts) since existing
// accounts created before this ticket may still be missing one.

import type { ErrorCode } from "@/lib/errorCodes";

export interface ProfileInput {
  displayName: string;
  phone: string;
  address: string;
  lineId: string;
}

export type ProfileValidationResult = { ok: true } | { ok: false; errorCode: ErrorCode };

const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15;
const DISPLAY_NAME_MAX = 50;
const ADDRESS_MAX = 200;
const LINE_ID_PATTERN = /^[a-zA-Z0-9._-]{4,20}$/;

export function validateProfile(input: ProfileInput): ProfileValidationResult {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    return { ok: false, errorCode: "DISPLAY_NAME_REQUIRED" };
  }
  if (displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, errorCode: "DISPLAY_NAME_TOO_LONG" };
  }

  const lineId = input.lineId.trim();
  if (lineId.length === 0) {
    return { ok: false, errorCode: "LINE_ID_REQUIRED" };
  }
  if (!LINE_ID_PATTERN.test(lineId)) {
    return { ok: false, errorCode: "LINE_ID_INVALID_FORMAT" };
  }

  const phone = input.phone.trim();
  if (phone.length === 0) {
    return { ok: false, errorCode: "PHONE_REQUIRED" };
  }
  if (!/^[0-9\- ]+$/.test(phone)) {
    return { ok: false, errorCode: "PHONE_INVALID_FORMAT" };
  }
  const digitCount = phone.replace(/[^0-9]/g, "").length;
  if (digitCount < PHONE_DIGITS_MIN || digitCount > PHONE_DIGITS_MAX) {
    return { ok: false, errorCode: "PHONE_INVALID_LENGTH" };
  }

  const address = input.address.trim();
  if (address.length === 0) {
    return { ok: false, errorCode: "ADDRESS_REQUIRED" };
  }
  if (address.length > ADDRESS_MAX) {
    return { ok: false, errorCode: "ADDRESS_TOO_LONG" };
  }

  return { ok: true };
}
