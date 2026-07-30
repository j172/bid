// Pure validation for the account profile fields (display name, phone,
// address) — required at registration and editable later via /account.
// No HTTP/DB involved, so it's directly unit-testable (see profile.test.ts).

export interface ProfileInput {
  displayName: string;
  phone: string;
  address: string;
}

export type ProfileValidationResult = { ok: true } | { ok: false; error: string };

const PHONE_DIGITS_MIN = 7;
const PHONE_DIGITS_MAX = 15;
const DISPLAY_NAME_MAX = 50;
const ADDRESS_MAX = 200;

export function validateProfile(input: ProfileInput): ProfileValidationResult {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    return { ok: false, error: "請輸入顯示名稱" };
  }
  if (displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `顯示名稱不能超過 ${DISPLAY_NAME_MAX} 個字` };
  }

  const phone = input.phone.trim();
  if (phone.length === 0) {
    return { ok: false, error: "請輸入聯絡電話" };
  }
  if (!/^[0-9\- ]+$/.test(phone)) {
    return { ok: false, error: "電話只能包含數字、- 和空格" };
  }
  const digitCount = phone.replace(/[^0-9]/g, "").length;
  if (digitCount < PHONE_DIGITS_MIN || digitCount > PHONE_DIGITS_MAX) {
    return { ok: false, error: `電話號碼位數需介於 ${PHONE_DIGITS_MIN} 到 ${PHONE_DIGITS_MAX} 碼之間` };
  }

  const address = input.address.trim();
  if (address.length === 0) {
    return { ok: false, error: "請輸入地址" };
  }
  if (address.length > ADDRESS_MAX) {
    return { ok: false, error: `地址不能超過 ${ADDRESS_MAX} 個字` };
  }

  return { ok: true };
}
