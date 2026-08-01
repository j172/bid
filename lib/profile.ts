// Pure validation for the account profile fields (display name, phone,
// address) — required at registration and editable later via /account.
// No HTTP/DB involved, so it's directly unit-testable (see profile.test.ts).

import type { ErrorCode } from "@/lib/errorCodes";

export interface ProfileInput {
  displayName: string;
  phone: string;
  address: string;
}

export type ProfileValidationResult = { ok: true } | { ok: false; errorCode: ErrorCode };

const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15;
const DISPLAY_NAME_MAX = 50;
const ADDRESS_MAX = 200;

export function validateProfile(input: ProfileInput): ProfileValidationResult {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    return { ok: false, errorCode: "DISPLAY_NAME_REQUIRED" };
  }
  if (displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, errorCode: "DISPLAY_NAME_TOO_LONG" };
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
