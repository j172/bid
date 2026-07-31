// Pure validation for the "mark settled" form (remittance account + amount)
// on the admin closed-listings page. No HTTP/DB involved, so it's directly
// unit-testable (see settlement.test.ts).

export interface SettlementInput {
  account: string;
  amount: number;
}

export type SettlementValidationResult = { ok: true } | { ok: false; error: string };

const ACCOUNT_MIN = 4;
const ACCOUNT_MAX = 30;

export function validateSettlement(input: SettlementInput): SettlementValidationResult {
  const account = input.account.trim();
  if (account.length === 0) {
    return { ok: false, error: "請輸入匯款帳號" };
  }
  if (!/^[A-Za-z0-9-]+$/.test(account)) {
    return { ok: false, error: "匯款帳號只能包含英數字與橫線" };
  }
  if (account.length < ACCOUNT_MIN || account.length > ACCOUNT_MAX) {
    return { ok: false, error: `匯款帳號長度需介於 ${ACCOUNT_MIN} 到 ${ACCOUNT_MAX} 位之間` };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0 || !Number.isInteger(input.amount)) {
    return { ok: false, error: "金額必須是正整數" };
  }

  return { ok: true };
}
