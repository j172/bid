// lib/passwordReset.ts mixes a pure decision function (isResetTokenValid,
// tested directly with no mocking, same split as lib/newsNewsletterSync.ts's
// resolveOrigin/parseScheduledAt) with raw-SQL CRUD (createPasswordResetToken/
// isPasswordResetRateLimited/resetPassword), which — like
// lib/homepageSections.ts's tests — mocks @/lib/db's getDb() and asserts on
// the SQL/params each function sends. queryMock is created via vi.hoisted so
// it exists before vi.mock's factory below runs.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import { createPasswordResetToken, isPasswordResetRateLimited, isResetTokenValid, resetPassword } from "./passwordReset";

beforeEach(() => {
  queryMock.mockReset();
});

describe("isResetTokenValid", () => {
  const now = new Date("2026-08-08T12:00:00Z");

  it("rejects a missing row (unknown token)", () => {
    expect(isResetTokenValid(null, now)).toBe(false);
  });

  it("rejects a row that has already been used", () => {
    const row = { user_id: 1, expires_at: new Date("2026-08-08T12:20:00Z"), used_at: new Date("2026-08-08T11:50:00Z") };
    expect(isResetTokenValid(row, now)).toBe(false);
  });

  it("rejects a row past its 30-minute expiry", () => {
    const row = { user_id: 1, expires_at: new Date("2026-08-08T11:59:59Z"), used_at: null };
    expect(isResetTokenValid(row, now)).toBe(false);
  });

  it("accepts an unused, not-yet-expired row", () => {
    const row = { user_id: 1, expires_at: new Date("2026-08-08T12:00:01Z"), used_at: null };
    expect(isResetTokenValid(row, now)).toBe(true);
  });
});

describe("isPasswordResetRateLimited", () => {
  it("is rate limited when this account requested a reset within the last 60 seconds", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    const limited = await isPasswordResetRateLimited(42, "203.0.113.7");
    expect(limited).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("user_id = ?");
    expect(queryMock.mock.calls[0][1]).toEqual([42]);
  });

  it("is rate limited when this IP has made 5+ requests in the last 15 minutes", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]); // email cooldown: clear
    queryMock.mockResolvedValueOnce([[{ cnt: 5 }]]); // ip window: at the cap
    const limited = await isPasswordResetRateLimited(42, "203.0.113.7");
    expect(limited).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("request_ip = ?");
    expect(queryMock.mock.calls[1][1]).toEqual(["203.0.113.7"]);
  });

  it("is not rate limited when both checks are clear", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[{ cnt: 4 }]]);
    expect(await isPasswordResetRateLimited(42, "203.0.113.7")).toBe(false);
  });

  it("skips the IP check entirely when no IP is available", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    expect(await isPasswordResetRateLimited(42, null)).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("createPasswordResetToken", () => {
  it("inserts a 32-byte hex token bound to the user and requesting IP", async () => {
    queryMock.mockResolvedValueOnce([{}]);
    const token = await createPasswordResetToken(7, "203.0.113.7");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("INSERT INTO password_reset_tokens");
    expect(params[0]).toBe(token);
    expect(params[1]).toBe(7);
    expect(params[2]).toBe("203.0.113.7");
    expect(params[3]).toBeInstanceOf(Date);
  });

  it("generates a different token on every call", async () => {
    queryMock.mockResolvedValue([{}]);
    const a = await createPasswordResetToken(1, null);
    const b = await createPasswordResetToken(1, null);
    expect(a).not.toBe(b);
  });
});

describe("resetPassword", () => {
  it("rejects an unknown token without touching the database further", async () => {
    queryMock.mockResolvedValueOnce([[]]); // SELECT finds nothing
    const result = await resetPassword("nope", "newpassword1");
    expect(result).toEqual({ ok: false, errorCode: "RESET_TOKEN_INVALID" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-used token", async () => {
    queryMock.mockResolvedValueOnce([
      [{ user_id: 1, expires_at: new Date(Date.now() + 60_000), used_at: new Date() }],
    ]);
    const result = await resetPassword("used-token", "newpassword1");
    expect(result).toEqual({ ok: false, errorCode: "RESET_TOKEN_INVALID" });
  });

  it("rejects an expired token", async () => {
    queryMock.mockResolvedValueOnce([[{ user_id: 1, expires_at: new Date(Date.now() - 1000), used_at: null }]]);
    const result = await resetPassword("expired-token", "newpassword1");
    expect(result).toEqual({ ok: false, errorCode: "RESET_TOKEN_INVALID" });
  });

  it("rejects a too-short new password without writing anything", async () => {
    queryMock.mockResolvedValueOnce([[{ user_id: 1, expires_at: new Date(Date.now() + 60_000), used_at: null }]]);
    const result = await resetPassword("valid-token", "short");
    expect(result).toEqual({ ok: false, errorCode: "NEW_PASSWORD_TOO_SHORT" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("updates the password, marks the token used, and deletes every session for the account", async () => {
    queryMock.mockResolvedValueOnce([[{ user_id: 9, expires_at: new Date(Date.now() + 60_000), used_at: null }]]); // SELECT
    queryMock.mockResolvedValueOnce([{}]); // UPDATE users
    queryMock.mockResolvedValueOnce([{}]); // UPDATE password_reset_tokens
    queryMock.mockResolvedValueOnce([{}]); // DELETE sessions

    const result = await resetPassword("valid-token", "newpassword1");

    expect(result).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(queryMock.mock.calls[1][0]).toContain("UPDATE users SET password_hash");
    expect(queryMock.mock.calls[1][1][2]).toBe(9);
    expect(queryMock.mock.calls[2][0]).toContain("UPDATE password_reset_tokens SET used_at");
    expect(queryMock.mock.calls[2][1]).toEqual(["valid-token"]);
    expect(queryMock.mock.calls[3][0]).toBe("DELETE FROM sessions WHERE user_id = ?");
    expect(queryMock.mock.calls[3][1]).toEqual([9]);
  });
});
