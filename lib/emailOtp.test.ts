// lib/emailOtp.ts mixes pure decision/hash functions (isEmailOtpChallengeUsable,
// hashEmailOtpCode, generateEmailOtpCode — tested directly with no mocking,
// same split lib/passwordReset.ts uses for isResetTokenValid) with raw-SQL
// CRUD (createEmailOtpChallenge/isEmailOtpRateLimited/verifyEmailOtpChallenge),
// which — like lib/passwordReset.test.ts — mocks @/lib/db's getDb() and
// asserts on the SQL/params each function sends. queryMock is created via
// vi.hoisted so it exists before vi.mock's factory below runs.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import {
  EMAIL_OTP_MAX_ATTEMPTS,
  createEmailOtpChallenge,
  generateEmailOtpCode,
  hashEmailOtpCode,
  isEmailOtpChallengeUsable,
  isEmailOtpRateLimited,
  verifyEmailOtpChallenge,
} from "./emailOtp";

beforeEach(() => {
  queryMock.mockReset();
});

describe("generateEmailOtpCode", () => {
  it("always returns a zero-padded 6-digit string", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateEmailOtpCode();
      expect(code).toMatch(/^[0-9]{6}$/);
    }
  });
});

describe("hashEmailOtpCode", () => {
  it("is deterministic for the same token/code pair", () => {
    expect(hashEmailOtpCode("token-a", "123456")).toBe(hashEmailOtpCode("token-a", "123456"));
  });

  it("differs when the token (salt) differs, even for the same code", () => {
    expect(hashEmailOtpCode("token-a", "123456")).not.toBe(hashEmailOtpCode("token-b", "123456"));
  });

  it("differs when the code differs, even for the same token", () => {
    expect(hashEmailOtpCode("token-a", "123456")).not.toBe(hashEmailOtpCode("token-a", "654321"));
  });

  it("returns a 64-char hex sha256 digest", () => {
    expect(hashEmailOtpCode("token-a", "123456")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("isEmailOtpChallengeUsable", () => {
  const now = new Date("2026-08-08T12:00:00Z");
  const baseRow = { user_id: 1, code_hash: "abc", expires_at: new Date("2026-08-08T12:05:00Z"), attempts: 0, used_at: null };

  it("rejects a missing row (unknown token)", () => {
    expect(isEmailOtpChallengeUsable(null, now)).toBe(false);
  });

  it("rejects a row that has already been used", () => {
    expect(isEmailOtpChallengeUsable({ ...baseRow, used_at: new Date("2026-08-08T11:50:00Z") }, now)).toBe(false);
  });

  it("rejects a row past its 10-minute expiry", () => {
    expect(isEmailOtpChallengeUsable({ ...baseRow, expires_at: new Date("2026-08-08T11:59:59Z") }, now)).toBe(false);
  });

  it("rejects a row that has hit the attempt cap", () => {
    expect(isEmailOtpChallengeUsable({ ...baseRow, attempts: EMAIL_OTP_MAX_ATTEMPTS }, now)).toBe(false);
  });

  it("rejects a row past the attempt cap", () => {
    expect(isEmailOtpChallengeUsable({ ...baseRow, attempts: EMAIL_OTP_MAX_ATTEMPTS + 1 }, now)).toBe(false);
  });

  it("accepts an unused, not-yet-expired row under the attempt cap", () => {
    expect(isEmailOtpChallengeUsable({ ...baseRow, attempts: EMAIL_OTP_MAX_ATTEMPTS - 1 }, now)).toBe(true);
  });
});

describe("isEmailOtpRateLimited", () => {
  it("is rate limited when this account requested a challenge within the last 60 seconds", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    const limited = await isEmailOtpRateLimited(42, "203.0.113.7");
    expect(limited).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("user_id = ?");
    expect(queryMock.mock.calls[0][1]).toEqual([42]);
  });

  it("is rate limited when this IP has made 5+ requests in the last 15 minutes", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]); // account cooldown: clear
    queryMock.mockResolvedValueOnce([[{ cnt: 5 }]]); // ip window: at the cap
    const limited = await isEmailOtpRateLimited(42, "203.0.113.7");
    expect(limited).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("request_ip = ?");
    expect(queryMock.mock.calls[1][1]).toEqual(["203.0.113.7"]);
  });

  it("is not rate limited when both checks are clear", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[{ cnt: 4 }]]);
    expect(await isEmailOtpRateLimited(42, "203.0.113.7")).toBe(false);
  });

  it("skips the IP check entirely when no IP is available", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    expect(await isEmailOtpRateLimited(42, null)).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("createEmailOtpChallenge", () => {
  it("inserts a 32-byte hex token bound to the user and requesting IP, with a hashed code", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    const { token, code } = await createEmailOtpChallenge(7, "203.0.113.7");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(code).toMatch(/^[0-9]{6}$/);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("INSERT INTO email_otp_challenges");
    expect(params[0]).toBe(token);
    expect(params[1]).toBe(7);
    expect(params[2]).toBe(hashEmailOtpCode(token, code));
    expect(params[3]).toBe("203.0.113.7");
    expect(params[4]).toBeInstanceOf(Date);
  });

  it("generates a different token and code on every call", async () => {
    queryMock.mockResolvedValue([{}]);
    const a = await createEmailOtpChallenge(1, null);
    const b = await createEmailOtpChallenge(1, null);
    expect(a.token).not.toBe(b.token);
  });
});

describe("verifyEmailOtpChallenge", () => {
  it("rejects an unknown token without touching the database further", async () => {
    queryMock.mockResolvedValueOnce([[]]); // SELECT finds nothing
    const result = await verifyEmailOtpChallenge("nope", "123456");
    expect(result).toEqual({ ok: false, errorCode: "EMAIL_OTP_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-used challenge", async () => {
    queryMock.mockResolvedValueOnce([
      [{ user_id: 1, code_hash: hashEmailOtpCode("used-token", "123456"), expires_at: new Date(Date.now() + 60_000), attempts: 0, used_at: new Date() }],
    ]);
    const result = await verifyEmailOtpChallenge("used-token", "123456");
    expect(result).toEqual({ ok: false, errorCode: "EMAIL_OTP_INVALID" });
  });

  it("rejects an expired challenge", async () => {
    queryMock.mockResolvedValueOnce([
      [{ user_id: 1, code_hash: hashEmailOtpCode("expired-token", "123456"), expires_at: new Date(Date.now() - 1000), attempts: 0, used_at: null }],
    ]);
    const result = await verifyEmailOtpChallenge("expired-token", "123456");
    expect(result).toEqual({ ok: false, errorCode: "EMAIL_OTP_INVALID" });
  });

  it("rejects a challenge already at the attempt cap without re-checking the code", async () => {
    queryMock.mockResolvedValueOnce([
      [{ user_id: 1, code_hash: hashEmailOtpCode("capped-token", "123456"), expires_at: new Date(Date.now() + 60_000), attempts: EMAIL_OTP_MAX_ATTEMPTS, used_at: null }],
    ]);
    const result = await verifyEmailOtpChallenge("capped-token", "123456");
    expect(result).toEqual({ ok: false, errorCode: "EMAIL_OTP_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("increments attempts on a wrong code, staying below the cap", async () => {
    queryMock.mockResolvedValueOnce([
      [{ user_id: 9, code_hash: hashEmailOtpCode("valid-token", "123456"), expires_at: new Date(Date.now() + 60_000), attempts: 1, used_at: null }],
    ]); // SELECT
    queryMock.mockResolvedValueOnce([{}]); // UPDATE attempts

    const result = await verifyEmailOtpChallenge("valid-token", "000000");

    expect(result).toEqual({ ok: false, errorCode: "EMAIL_OTP_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("UPDATE email_otp_challenges SET attempts = ?");
    expect(queryMock.mock.calls[1][0]).not.toContain("used_at");
    expect(queryMock.mock.calls[1][1]).toEqual([2, "valid-token"]);
  });

  it("invalidates the whole challenge once a wrong code pushes attempts to the cap", async () => {
    queryMock.mockResolvedValueOnce([
      [{ user_id: 9, code_hash: hashEmailOtpCode("valid-token", "123456"), expires_at: new Date(Date.now() + 60_000), attempts: EMAIL_OTP_MAX_ATTEMPTS - 1, used_at: null }],
    ]); // SELECT
    queryMock.mockResolvedValueOnce([{}]); // UPDATE attempts + used_at

    const result = await verifyEmailOtpChallenge("valid-token", "000000");

    expect(result).toEqual({ ok: false, errorCode: "EMAIL_OTP_TOO_MANY_ATTEMPTS" });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("attempts = ?, used_at = NOW()");
    expect(queryMock.mock.calls[1][1]).toEqual([EMAIL_OTP_MAX_ATTEMPTS, "valid-token"]);
  });

  it("accepts a correct code, spends the challenge, and returns the userId", async () => {
    queryMock.mockResolvedValueOnce([
      [{ user_id: 9, code_hash: hashEmailOtpCode("valid-token", "123456"), expires_at: new Date(Date.now() + 60_000), attempts: 0, used_at: null }],
    ]); // SELECT
    queryMock.mockResolvedValueOnce([{}]); // UPDATE used_at

    const result = await verifyEmailOtpChallenge("valid-token", "123456");

    expect(result).toEqual({ ok: true, userId: 9 });
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("UPDATE email_otp_challenges SET used_at = NOW()");
    expect(queryMock.mock.calls[1][1]).toEqual(["valid-token"]);
  });
});
