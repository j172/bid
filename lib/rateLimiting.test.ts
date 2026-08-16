// Locks isCooldownRateLimited's SQL/params shape before lib/passwordReset.ts,
// lib/emailVerification.ts and lib/emailOtp.ts are switched over to it (issue
// #161) — same mocked-getDb style as lib/passwordReset.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

import { isCooldownRateLimited } from "./rateLimiting";

beforeEach(() => {
  queryMock.mockReset();
});

const OPTIONS = { cooldownSeconds: 60, windowMinutes: 15, maxRequests: 5 };

describe("isCooldownRateLimited", () => {
  it("is rate limited when this account has a row within the cooldown", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    const limited = await isCooldownRateLimited("password_reset_tokens", 42, "203.0.113.7", OPTIONS);
    expect(limited).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][0]).toContain("FROM password_reset_tokens");
    expect(queryMock.mock.calls[0][0]).toContain("user_id = ?");
    expect(queryMock.mock.calls[0][0]).toContain("INTERVAL 60 SECOND");
    expect(queryMock.mock.calls[0][1]).toEqual([42]);
  });

  it("is rate limited when this IP has reached maxRequests within the window", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]); // account cooldown: clear
    queryMock.mockResolvedValueOnce([[{ cnt: 5 }]]); // ip window: at the cap
    const limited = await isCooldownRateLimited("email_otp_challenges", 42, "203.0.113.7", OPTIONS);
    expect(limited).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][0]).toContain("FROM email_otp_challenges");
    expect(queryMock.mock.calls[1][0]).toContain("request_ip = ?");
    expect(queryMock.mock.calls[1][0]).toContain("INTERVAL 15 MINUTE");
    expect(queryMock.mock.calls[1][1]).toEqual(["203.0.113.7"]);
  });

  it("is not rate limited just under the IP cap", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[{ cnt: 4 }]]);
    expect(await isCooldownRateLimited("email_verification_tokens", 42, "203.0.113.7", OPTIONS)).toBe(false);
  });

  it("is not rate limited when both checks are clear", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    expect(await isCooldownRateLimited("password_reset_tokens", 42, "203.0.113.7", OPTIONS)).toBe(false);
  });

  it("skips the IP check entirely when no IP is available", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    expect(await isCooldownRateLimited("password_reset_tokens", 42, null, OPTIONS)).toBe(false);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("respects per-caller threshold options rather than a hardcoded default", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[{ cnt: 50 }]]); // below a much higher IP cap
    const limited = await isCooldownRateLimited("password_reset_tokens", 42, "203.0.113.7", {
      cooldownSeconds: 30,
      windowMinutes: 60,
      maxRequests: 100,
    });
    expect(limited).toBe(false);
    expect(queryMock.mock.calls[0][0]).toContain("INTERVAL 30 SECOND");
    expect(queryMock.mock.calls[1][0]).toContain("INTERVAL 60 MINUTE");
  });
});
