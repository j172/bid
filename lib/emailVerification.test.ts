// lib/emailVerification.ts mixes a pure decision function
// (isEmailVerificationTokenValid, tested directly with no mocking, same
// split as lib/passwordReset.ts's isResetTokenValid) with raw-SQL CRUD
// (createEmailVerificationToken/isEmailVerificationRateLimited/
// verifyEmailVerificationToken), which — like lib/passwordReset.test.ts —
// mocks @/lib/db's getDb() and asserts on the SQL/params each function
// sends. queryMock is created via vi.hoisted so it exists before vi.mock's
// factory below runs.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import {
  createEmailVerificationToken,
  isEmailVerificationRateLimited,
  isEmailVerificationTokenValid,
  verifyEmailPath,
  verifyEmailVerificationToken,
} from "./emailVerification";

beforeEach(() => {
  queryMock.mockReset();
});

describe("isEmailVerificationTokenValid", () => {
  const now = new Date("2026-08-08T12:00:00Z");

  it("rejects a missing row (unknown token)", () => {
    expect(isEmailVerificationTokenValid(null, now)).toBe(false);
  });

  it("rejects a row that has already been used", () => {
    const row = { user_id: 1, expires_at: new Date("2026-08-09T11:00:00Z"), used_at: new Date("2026-08-08T11:50:00Z") };
    expect(isEmailVerificationTokenValid(row, now)).toBe(false);
  });

  it("rejects a row past its 24-hour expiry", () => {
    const row = { user_id: 1, expires_at: new Date("2026-08-08T11:59:59Z"), used_at: null };
    expect(isEmailVerificationTokenValid(row, now)).toBe(false);
  });

  it("accepts an unused, not-yet-expired row", () => {
    const row = { user_id: 1, expires_at: new Date("2026-08-09T12:00:00Z"), used_at: null };
    expect(isEmailVerificationTokenValid(row, now)).toBe(true);
  });
});

describe("verifyEmailPath", () => {
  it("omits the locale prefix for the default locale (zh-TW)", () => {
    expect(verifyEmailPath("zh-TW", "abc123")).toBe("/verify-email?token=abc123");
  });

  it("prefixes non-default locales with /{locale}", () => {
    expect(verifyEmailPath("en", "abc123")).toBe("/en/verify-email?token=abc123");
    expect(verifyEmailPath("zh-CN", "abc123")).toBe("/zh-CN/verify-email?token=abc123");
  });

  it("URL-encodes the token", () => {
    expect(verifyEmailPath("zh-TW", "a b/c")).toBe("/verify-email?token=a%20b%2Fc");
  });
});

describe("isEmailVerificationRateLimited", () => {
  it("is rate limited when this account requested a verification email within the last 60 seconds", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    const limited = await isEmailVerificationRateLimited(42, "203.0.113.7");
    expect(limited).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("user_id = ?");
    expect(queryMock.mock.calls[0][1]).toEqual([42]);
  });

  it("is rate limited when this IP has made 5+ requests in the last 15 minutes", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]); // email cooldown: clear
    queryMock.mockResolvedValueOnce([[{ cnt: 5 }]]); // ip window: at the cap
    const limited = await isEmailVerificationRateLimited(42, "203.0.113.7");
    expect(limited).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("request_ip = ?");
    expect(queryMock.mock.calls[1][1]).toEqual(["203.0.113.7"]);
  });

  it("is not rate limited when both checks are clear", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[{ cnt: 4 }]]);
    expect(await isEmailVerificationRateLimited(42, "203.0.113.7")).toBe(false);
  });

  it("skips the IP check entirely when no IP is available", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    expect(await isEmailVerificationRateLimited(42, null)).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("createEmailVerificationToken", () => {
  it("inserts a 32-byte hex token bound to the user and requesting IP", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    const token = await createEmailVerificationToken(7, "203.0.113.7");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("INSERT INTO email_verification_tokens");
    expect(params[0]).toBe(token);
    expect(params[1]).toBe(7);
    expect(params[2]).toBe("203.0.113.7");
    expect(params[3]).toBeInstanceOf(Date);
  });

  it("generates a different token on every call", async () => {
    queryMock.mockResolvedValue([{}]);
    const a = await createEmailVerificationToken(1, null);
    const b = await createEmailVerificationToken(1, null);
    expect(a).not.toBe(b);
  });
});

describe("verifyEmailVerificationToken", () => {
  it("rejects an unknown token without touching the database further", async () => {
    queryMock.mockResolvedValueOnce([[]]); // SELECT finds nothing
    const result = await verifyEmailVerificationToken("nope");
    expect(result).toEqual({ ok: false, errorCode: "EMAIL_VERIFICATION_TOKEN_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-used token", async () => {
    queryMock.mockResolvedValueOnce([
      [{ user_id: 1, expires_at: new Date(Date.now() + 60_000), used_at: new Date() }],
    ]);
    const result = await verifyEmailVerificationToken("used-token");
    expect(result).toEqual({ ok: false, errorCode: "EMAIL_VERIFICATION_TOKEN_INVALID" });
  });

  it("rejects an expired token", async () => {
    queryMock.mockResolvedValueOnce([[{ user_id: 1, expires_at: new Date(Date.now() - 1000), used_at: null }]]);
    const result = await verifyEmailVerificationToken("expired-token");
    expect(result).toEqual({ ok: false, errorCode: "EMAIL_VERIFICATION_TOKEN_INVALID" });
  });

  it("marks the account verified and the token used", async () => {
    queryMock.mockResolvedValueOnce([[{ user_id: 9, expires_at: new Date(Date.now() + 60_000), used_at: null }]]); // SELECT
    queryMock.mockResolvedValueOnce([{}]); // UPDATE users
    queryMock.mockResolvedValueOnce([{}]); // UPDATE email_verification_tokens

    const result = await verifyEmailVerificationToken("valid-token");

    expect(result).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[1][0]).toBe("UPDATE users SET email_verified = 1 WHERE id = ?");
    expect(queryMock.mock.calls[1][1]).toEqual([9]);
    expect(queryMock.mock.calls[2][0]).toContain("UPDATE email_verification_tokens SET used_at");
    expect(queryMock.mock.calls[2][1]).toEqual(["valid-token"]);
  });
});
