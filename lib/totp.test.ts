// lib/totp.ts mixes pure decision/crypto functions (isTotpCodeFormat/
// isBackupCodeFormat/hashBackupCode/generateBackupCode/verifyTotpCode/
// isTotpSetupChallengeUsable — tested directly with no mocking, same split
// lib/emailOtp.ts/lib/webauthn.ts use for their own pure functions) with
// raw-SQL CRUD (startTotpSetup/confirmTotpSetup/disableTotp/
// verifyAndConsumeBackupCode/verifyTotpLogin), which — like
// lib/emailOtp.test.ts/lib/webauthnCredentials.test.ts — mocks @/lib/db's
// getDb() and asserts on the SQL/params each function sends. queryMock is
// created via vi.hoisted so it exists before vi.mock's factory below runs.
// lib/auth.ts's disableTotp dependency (setTwoFactorMethod) and
// confirmTotpSetup's own inline password check both go through the *same*
// mocked getDb(), so no separate mock is needed for @/lib/auth — only its
// real scrypt-based hashPassword/verifyPassword run, against a real
// hash/salt pair generated once up front.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import { hashPassword } from "./auth";
import {
  BACKUP_CODE_COUNT,
  TOTP_LOGIN_MAX_ATTEMPTS,
  confirmTotpSetup,
  disableTotp,
  generateBackupCode,
  generateTotpSecret,
  buildTotpUri,
  hashBackupCode,
  isBackupCodeFormat,
  isTotpCodeFormat,
  isTotpLoginLocked,
  isTotpSetupChallengeUsable,
  startTotpSetup,
  verifyAndConsumeBackupCode,
  verifyTotpCode,
  verifyTotpLogin,
} from "./totp";
import { TOTP, Secret } from "otpauth";

beforeEach(() => {
  queryMock.mockReset();
});

const PASSWORD = "correct horse battery staple";
let passwordHash: string;
let passwordSalt: string;

beforeEach(async () => {
  const { hash, salt } = await hashPassword(PASSWORD);
  passwordHash = hash;
  passwordSalt = salt;
});

describe("generateTotpSecret", () => {
  it("returns a base32 secret, different on every call", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(a).not.toBe(b);
  });
});

describe("buildTotpUri", () => {
  it("returns an otpauth://totp/ URI carrying the secret and label", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, "someone@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${secret}`);
    expect(uri).toContain(encodeURIComponent("someone@example.com"));
  });
});

describe("verifyTotpCode", () => {
  it("accepts the current code for the secret at a given timestamp", () => {
    const secret = generateTotpSecret();
    const timestamp = Date.parse("2026-08-08T12:00:00Z");
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const code = totp.generate({ timestamp });
    expect(verifyTotpCode(secret, code, timestamp)).toBe(true);
  });

  it("rejects a wrong code", () => {
    const secret = generateTotpSecret();
    const timestamp = Date.parse("2026-08-08T12:00:00Z");
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const code = totp.generate({ timestamp });
    const wrongCode = code === "000000" ? "111111" : "000000";
    expect(verifyTotpCode(secret, wrongCode, timestamp)).toBe(false);
  });

  it("accepts a code from one period of drift away (±30s)", () => {
    const secret = generateTotpSecret();
    const timestamp = Date.parse("2026-08-08T12:00:00Z");
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const codeOnePeriodAgo = totp.generate({ timestamp: timestamp - 30_000 });
    expect(verifyTotpCode(secret, codeOnePeriodAgo, timestamp)).toBe(true);
  });

  it("rejects a code two periods away (outside the drift window)", () => {
    const secret = generateTotpSecret();
    const timestamp = Date.parse("2026-08-08T12:00:00Z");
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const codeTwoPeriodsAgo = totp.generate({ timestamp: timestamp - 60_000 });
    expect(verifyTotpCode(secret, codeTwoPeriodsAgo, timestamp)).toBe(false);
  });
});

describe("isTotpCodeFormat", () => {
  it("accepts a 6-digit code", () => {
    expect(isTotpCodeFormat("123456")).toBe(true);
  });

  it("rejects a backup-code-shaped string", () => {
    expect(isTotpCodeFormat("ab12c-34de5")).toBe(false);
  });

  it("rejects too few or too many digits", () => {
    expect(isTotpCodeFormat("12345")).toBe(false);
    expect(isTotpCodeFormat("1234567")).toBe(false);
  });

  it("tolerates surrounding whitespace", () => {
    expect(isTotpCodeFormat("  123456  ")).toBe(true);
  });
});

describe("isBackupCodeFormat", () => {
  it("accepts the 5-hex-dash-5-hex shape", () => {
    expect(isBackupCodeFormat("ab12c-34de5")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBackupCodeFormat("AB12C-34DE5")).toBe(true);
  });

  it("rejects a 6-digit code", () => {
    expect(isBackupCodeFormat("123456")).toBe(false);
  });

  it("rejects a malformed backup code", () => {
    expect(isBackupCodeFormat("ab12-34de5")).toBe(false);
    expect(isBackupCodeFormat("ab12cx-34de5")).toBe(false);
    expect(isBackupCodeFormat("gh12c-34de5")).toBe(false); // 'g'/'h' aren't hex
  });
});

describe("generateBackupCode", () => {
  it("always matches its own format checker, and differs on every call", () => {
    const a = generateBackupCode();
    const b = generateBackupCode();
    expect(isBackupCodeFormat(a)).toBe(true);
    expect(isBackupCodeFormat(b)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("hashBackupCode", () => {
  it("is deterministic for the same code", () => {
    expect(hashBackupCode("ab12c-34de5")).toBe(hashBackupCode("ab12c-34de5"));
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(hashBackupCode("AB12C-34DE5")).toBe(hashBackupCode(" ab12c-34de5 "));
  });

  it("differs for a different code", () => {
    expect(hashBackupCode("ab12c-34de5")).not.toBe(hashBackupCode("ff12c-34de5"));
  });

  it("returns a 64-char hex sha256 digest", () => {
    expect(hashBackupCode("ab12c-34de5")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isTotpSetupChallengeUsable", () => {
  const now = new Date("2026-08-08T12:00:00Z");
  const baseRow = { user_id: 1, secret: "SECRET", expires_at: new Date("2026-08-08T12:05:00Z"), used_at: null };

  it("rejects a missing row", () => {
    expect(isTotpSetupChallengeUsable(null, now)).toBe(false);
  });

  it("rejects an already-used row", () => {
    expect(isTotpSetupChallengeUsable({ ...baseRow, used_at: new Date("2026-08-08T11:50:00Z") }, now)).toBe(false);
  });

  it("rejects an expired row", () => {
    expect(isTotpSetupChallengeUsable({ ...baseRow, expires_at: new Date("2026-08-08T11:59:59Z") }, now)).toBe(false);
  });

  it("accepts an unused, not-yet-expired row", () => {
    expect(isTotpSetupChallengeUsable(baseRow, now)).toBe(true);
  });
});

describe("isTotpLoginLocked", () => {
  const now = new Date("2026-08-08T12:00:00Z");

  it("is not locked when totp_locked_until is null", () => {
    expect(isTotpLoginLocked(null, now)).toBe(false);
  });

  it("is not locked once the lockout has passed", () => {
    expect(isTotpLoginLocked(new Date("2026-08-08T11:59:59Z"), now)).toBe(false);
  });

  it("is locked while totp_locked_until is still in the future", () => {
    expect(isTotpLoginLocked(new Date("2026-08-08T12:00:01Z"), now)).toBe(true);
  });

  it("treats the exact boundary instant as no longer locked", () => {
    expect(isTotpLoginLocked(now, now)).toBe(false);
  });
});

describe("startTotpSetup", () => {
  it("inserts a fresh secret bound to the user and returns token/secret/otpauthUri", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    const result = await startTotpSetup(7, "someone@example.com");

    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.otpauthUri).toContain(`secret=${result.secret}`);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("INSERT INTO totp_setup_challenges");
    expect(params[0]).toBe(result.token);
    expect(params[1]).toBe(7);
    expect(params[2]).toBe(result.secret);
    expect(params[3]).toBeInstanceOf(Date);
  });
});

describe("confirmTotpSetup", () => {
  it("rejects a wrong current password without touching the challenge table", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    const result = await confirmTotpSetup(7, "wrong password", "token", "123456");
    expect(result).toEqual({ ok: false, errorCode: "WRONG_OLD_PASSWORD" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a challenge issued to a different user", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]); // password check
    queryMock.mockResolvedValueOnce([
      [{ user_id: 999, secret: "SECRET", expires_at: new Date(Date.now() + 60_000), used_at: null }],
    ]); // SELECT challenge — belongs to a different user
    const result = await confirmTotpSetup(7, PASSWORD, "token", "123456");
    expect(result).toEqual({ ok: false, errorCode: "TOTP_SETUP_CHALLENGE_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("rejects an expired challenge", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    queryMock.mockResolvedValueOnce([
      [{ user_id: 7, secret: "SECRET", expires_at: new Date(Date.now() - 1000), used_at: null }],
    ]);
    const result = await confirmTotpSetup(7, PASSWORD, "token", "123456");
    expect(result).toEqual({ ok: false, errorCode: "TOTP_SETUP_CHALLENGE_INVALID" });
  });

  it("rejects a wrong code and leaves the challenge unspent", async () => {
    const secret = generateTotpSecret();
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    queryMock.mockResolvedValueOnce([[{ user_id: 7, secret, expires_at: new Date(Date.now() + 60_000), used_at: null }]]);
    const result = await confirmTotpSetup(7, PASSWORD, "token", "000000");
    expect(result).toEqual({ ok: false, errorCode: "TOTP_CODE_INVALID" });
    // Only the password check + challenge lookup ran — no UPDATE queries.
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it("on a correct code: spends the challenge, promotes the secret, and mints BACKUP_CODE_COUNT backup codes", async () => {
    const secret = generateTotpSecret();
    const timestamp = Date.now();
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const code = totp.generate({ timestamp });

    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]); // password check
    queryMock.mockResolvedValueOnce([[{ user_id: 7, secret, expires_at: new Date(Date.now() + 60_000), used_at: null }]]); // SELECT challenge
    queryMock.mockResolvedValueOnce([{}]); // UPDATE challenge used_at
    queryMock.mockResolvedValueOnce([{}]); // UPDATE users totp_secret/two_factor_method
    queryMock.mockResolvedValueOnce([{}]); // INSERT backup codes

    const result = await confirmTotpSetup(7, PASSWORD, "token", code);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.backupCodes).toHaveLength(BACKUP_CODE_COUNT);
    expect(new Set(result.backupCodes).size).toBe(BACKUP_CODE_COUNT); // all unique
    result.backupCodes.forEach((backupCode) => expect(isBackupCodeFormat(backupCode)).toBe(true));

    expect(queryMock).toHaveBeenCalledTimes(5);
    expect(queryMock.mock.calls[2][0]).toContain("UPDATE totp_setup_challenges SET used_at = NOW()");
    expect(queryMock.mock.calls[3][0]).toContain("UPDATE users SET totp_secret = ?, two_factor_method = 'totp'");
    expect(queryMock.mock.calls[3][1]).toEqual([secret, 7]);
    expect(queryMock.mock.calls[4][0]).toContain("INSERT INTO totp_backup_codes");
    const insertedRows = queryMock.mock.calls[4][1][0] as [number, string, Date][];
    expect(insertedRows).toHaveLength(BACKUP_CODE_COUNT);
    expect(insertedRows[0][0]).toBe(7);
    expect(insertedRows.map((row) => row[1])).toEqual(result.backupCodes.map((backupCode) => hashBackupCode(backupCode)));
  });
});

describe("disableTotp", () => {
  it("rejects a wrong current password without clearing anything", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]);
    const result = await disableTotp(7, "wrong password");
    expect(result).toEqual({ ok: false, errorCode: "WRONG_OLD_PASSWORD" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("on a correct password: flips two_factor_method to none, then clears the secret and backup codes", async () => {
    queryMock.mockResolvedValueOnce([[{ password_hash: passwordHash, password_salt: passwordSalt }]]); // setTwoFactorMethod's password check
    queryMock.mockResolvedValueOnce([{}]); // setTwoFactorMethod's UPDATE
    queryMock.mockResolvedValueOnce([{}]); // UPDATE totp_secret = NULL
    queryMock.mockResolvedValueOnce([{}]); // DELETE totp_backup_codes

    const result = await disableTotp(7, PASSWORD);
    expect(result).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(queryMock.mock.calls[1][1]).toEqual(["none", 7]);
    expect(queryMock.mock.calls[2][0]).toContain("UPDATE users SET totp_secret = NULL");
    expect(queryMock.mock.calls[3][0]).toBe("DELETE FROM totp_backup_codes WHERE user_id = ?");
    expect(queryMock.mock.calls[3][1]).toEqual([7]);
  });
});

describe("verifyAndConsumeBackupCode", () => {
  it("returns ok:false when no unused row matches (wrong code or already used)", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await verifyAndConsumeBackupCode(7, "ab12c-34de5");
    expect(result).toEqual({ ok: false });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("atomically marks the matching row used and returns the remaining count", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE ... WHERE used_at IS NULL
    queryMock.mockResolvedValueOnce([[{ cnt: 9 }]]); // remaining count

    const result = await verifyAndConsumeBackupCode(7, "ab12c-34de5");
    expect(result).toEqual({ ok: true, remaining: 9 });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][0]).toContain("used_at IS NULL");
    expect(queryMock.mock.calls[0][1]).toEqual([7, hashBackupCode("ab12c-34de5")]);
  });
});

describe("verifyTotpLogin", () => {
  function mockSecretRow(secret: string | null, attempts = 0, lockedUntil: Date | null = null) {
    queryMock.mockResolvedValueOnce([[{ totp_secret: secret, totp_failed_attempts: attempts, totp_locked_until: lockedUntil }]]);
  }

  it("rejects when the account has no totp_secret", async () => {
    mockSecretRow(null);
    const result = await verifyTotpLogin(7, "123456");
    expect(result).toEqual({ ok: false, errorCode: "TOTP_CODE_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("verifies a 6-digit code against the stored secret", async () => {
    const secret = generateTotpSecret();
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const code = totp.generate();

    mockSecretRow(secret);
    const result = await verifyTotpLogin(7, code);
    expect(result).toEqual({ ok: true, usedBackupCode: false });
    expect(queryMock).toHaveBeenCalledTimes(1); // no backup-code query, no attempts reset needed (already 0)
  });

  it("resets a previously nonzero attempts count on success", async () => {
    const secret = generateTotpSecret();
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const code = totp.generate();

    mockSecretRow(secret, 3);
    queryMock.mockResolvedValueOnce([{}]); // UPDATE reset attempts/locked_until

    const result = await verifyTotpLogin(7, code);
    expect(result).toEqual({ ok: true, usedBackupCode: false });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("totp_failed_attempts = 0, totp_locked_until = NULL");
    expect(queryMock.mock.calls[1][1]).toEqual([7]);
  });

  it("rejects a wrong 6-digit code and increments totp_failed_attempts", async () => {
    const secret = generateTotpSecret();
    mockSecretRow(secret, 1);
    queryMock.mockResolvedValueOnce([{}]); // UPDATE attempts

    const result = await verifyTotpLogin(7, "000000");
    expect(result).toEqual({ ok: false, errorCode: "TOTP_CODE_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toBe("UPDATE users SET totp_failed_attempts = ? WHERE id = ?");
    expect(queryMock.mock.calls[1][1]).toEqual([2, 7]);
  });

  it("locks the account once a wrong code pushes attempts to TOTP_LOGIN_MAX_ATTEMPTS", async () => {
    const secret = generateTotpSecret();
    mockSecretRow(secret, TOTP_LOGIN_MAX_ATTEMPTS - 1);
    queryMock.mockResolvedValueOnce([{}]); // UPDATE attempts + locked_until

    const result = await verifyTotpLogin(7, "000000");
    expect(result).toEqual({ ok: false, errorCode: "TOTP_CODE_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toBe("UPDATE users SET totp_failed_attempts = ?, totp_locked_until = ? WHERE id = ?");
    expect(queryMock.mock.calls[1][1][0]).toBe(TOTP_LOGIN_MAX_ATTEMPTS);
    expect(queryMock.mock.calls[1][1][1]).toBeInstanceOf(Date);
    expect(queryMock.mock.calls[1][1][2]).toBe(7);
  });

  it("refuses to even check the code while locked out, without touching totp_failed_attempts", async () => {
    const secret = generateTotpSecret();
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const code = totp.generate(); // a *correct* code — still rejected while locked

    mockSecretRow(secret, TOTP_LOGIN_MAX_ATTEMPTS, new Date(Date.now() + 60_000));
    const result = await verifyTotpLogin(7, code);
    expect(result).toEqual({ ok: false, errorCode: "TOTP_LOGIN_LOCKED" });
    expect(queryMock).toHaveBeenCalledTimes(1); // only the initial SELECT — no UPDATE at all
  });

  it("allows verification again once the lockout has passed", async () => {
    const secret = generateTotpSecret();
    const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secret) });
    const code = totp.generate();

    mockSecretRow(secret, TOTP_LOGIN_MAX_ATTEMPTS, new Date(Date.now() - 1000)); // lockout already expired
    queryMock.mockResolvedValueOnce([{}]); // UPDATE reset attempts/locked_until on success

    const result = await verifyTotpLogin(7, code);
    expect(result).toEqual({ ok: true, usedBackupCode: false });
  });

  it("routes a backup-code-shaped input to verifyAndConsumeBackupCode", async () => {
    const secret = generateTotpSecret();
    mockSecretRow(secret); // SELECT totp_secret
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE backup code
    queryMock.mockResolvedValueOnce([[{ cnt: 3 }]]); // remaining count

    const result = await verifyTotpLogin(7, "ab12c-34de5");
    expect(result).toEqual({ ok: true, usedBackupCode: true, remainingBackupCodes: 3 });
  });

  it("rejects an unrecognized backup code and increments totp_failed_attempts", async () => {
    const secret = generateTotpSecret();
    mockSecretRow(secret);
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    queryMock.mockResolvedValueOnce([{}]); // UPDATE attempts

    const result = await verifyTotpLogin(7, "ab12c-34de5");
    expect(result).toEqual({ ok: false, errorCode: "TOTP_CODE_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[2][1]).toEqual([1, 7]);
  });

  it("rejects input matching neither format and still counts as a failed attempt", async () => {
    const secret = generateTotpSecret();
    mockSecretRow(secret);
    queryMock.mockResolvedValueOnce([{}]); // UPDATE attempts

    const result = await verifyTotpLogin(7, "not-a-valid-code");
    expect(result).toEqual({ ok: false, errorCode: "TOTP_CODE_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});
