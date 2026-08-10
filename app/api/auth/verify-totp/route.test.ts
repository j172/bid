// Issue #140 H-1: this route re-verifies email+password itself (see the
// route's header comment), so it carries the same two guards the login route
// does — the brute-force rate limit and, on top of it, a Cloudflare
// Turnstile token. These tests cover only what the route itself is
// responsible for: consulting each guard in the right order and letting
// nothing downstream run when one says no. Every import is mocked, same
// style as app/api/auth/login/route.test.ts, so this never reaches the real
// createSession (which needs a request scope for next/headers' cookies())
// or the real lib/turnstile.ts (which would make a live siteverify call).
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUserByEmailMock, verifyPasswordMock, createSessionMock } = vi.hoisted(() => ({
  findUserByEmailMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  createSessionMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  findUserByEmail: findUserByEmailMock,
  verifyPassword: verifyPasswordMock,
  createSession: createSessionMock,
}));

const { isLoginRateLimitedMock, recordLoginFailureMock, clearLoginFailuresMock } = vi.hoisted(() => ({
  isLoginRateLimitedMock: vi.fn(),
  recordLoginFailureMock: vi.fn(),
  clearLoginFailuresMock: vi.fn(),
}));

vi.mock("@/lib/loginRateLimit", () => ({
  isLoginRateLimited: isLoginRateLimitedMock,
  recordLoginFailure: recordLoginFailureMock,
  clearLoginFailures: clearLoginFailuresMock,
}));

const { verifyTotpLoginMock } = vi.hoisted(() => ({
  verifyTotpLoginMock: vi.fn(),
}));

vi.mock("@/lib/totp", () => ({
  verifyTotpLogin: verifyTotpLoginMock,
}));

vi.mock("@/lib/clientIp", () => ({
  getClientIpFromHeaders: () => "203.0.113.7",
}));

const { verifyTurnstileTokenMock } = vi.hoisted(() => ({
  verifyTurnstileTokenMock: vi.fn(),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: verifyTurnstileTokenMock,
}));

import { POST } from "./route";

function verifyTotpRequest(body: unknown) {
  return new Request("http://localhost/api/auth/verify-totp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseUser = {
  id: 1,
  email: "visitor@example.com",
  password_hash: "hash",
  password_salt: "salt",
  role: "user" as const,
  suspended_at: null,
  locale: "zh-TW",
  email_verified: 1,
  two_factor_method: "totp" as const,
};

beforeEach(() => {
  findUserByEmailMock.mockReset();
  findUserByEmailMock.mockResolvedValue(baseUser);
  verifyPasswordMock.mockReset();
  verifyPasswordMock.mockResolvedValue(true);
  createSessionMock.mockReset();
  isLoginRateLimitedMock.mockReset();
  isLoginRateLimitedMock.mockResolvedValue(false);
  recordLoginFailureMock.mockReset();
  clearLoginFailuresMock.mockReset();
  verifyTotpLoginMock.mockReset();
  verifyTotpLoginMock.mockResolvedValue({ ok: true, usedBackupCode: false, remainingBackupCodes: 8 });
  verifyTurnstileTokenMock.mockReset();
  verifyTurnstileTokenMock.mockResolvedValue(true);
});

describe("POST /api/auth/verify-totp — Turnstile (issue #140 H-1)", () => {
  it("rejects a request whose Turnstile token fails verification, before the password is ever checked", async () => {
    verifyTurnstileTokenMock.mockResolvedValue(false);

    const response = await POST(
      verifyTotpRequest({ email: baseUser.email, password: "correct-password", code: "123456", turnstileToken: "stale-token" }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, errorCode: "TURNSTILE_VERIFICATION_FAILED" });
    expect(verifyTurnstileTokenMock).toHaveBeenCalledWith("stale-token", "203.0.113.7");
    expect(findUserByEmailMock).not.toHaveBeenCalled();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(verifyTotpLoginMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("does not count a failed Turnstile check as a password failure", async () => {
    verifyTurnstileTokenMock.mockResolvedValue(false);

    await POST(verifyTotpRequest({ email: baseUser.email, password: "correct-password", code: "123456", turnstileToken: "stale-token" }));

    expect(recordLoginFailureMock).not.toHaveBeenCalled();
    expect(clearLoginFailuresMock).not.toHaveBeenCalled();
  });

  it("rejects a request with no token at all, so the widget can't simply be skipped", async () => {
    verifyTurnstileTokenMock.mockResolvedValue(false);

    const response = await POST(verifyTotpRequest({ email: baseUser.email, password: "correct-password", code: "123456" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, errorCode: "TURNSTILE_VERIFICATION_FAILED" });
    expect(verifyTurnstileTokenMock).toHaveBeenCalledWith("", "203.0.113.7");
  });

  it("checks the rate limit first, so a locked-out attempt costs no siteverify call", async () => {
    isLoginRateLimitedMock.mockResolvedValue(true);

    const response = await POST(
      verifyTotpRequest({ email: baseUser.email, password: "any-password", code: "123456", turnstileToken: "fresh-token" }),
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data).toEqual({ ok: false, errorCode: "LOGIN_RATE_LIMITED" });
    expect(verifyTurnstileTokenMock).not.toHaveBeenCalled();
  });

  it("carries on with the normal TOTP flow once the token verifies", async () => {
    const response = await POST(
      verifyTotpRequest({ email: baseUser.email, password: "correct-password", code: "123456", turnstileToken: "fresh-token" }),
    );
    const data = await response.json();

    expect(data).toEqual({
      ok: true,
      user: { id: baseUser.id, email: baseUser.email, role: baseUser.role },
      usedBackupCode: false,
      remainingBackupCodes: 8,
    });
    expect(verifyTurnstileTokenMock).toHaveBeenCalledWith("fresh-token", "203.0.113.7");
    expect(verifyTotpLoginMock).toHaveBeenCalledWith(baseUser.id, "123456");
    expect(createSessionMock).toHaveBeenCalledWith(baseUser.id);
  });

  it("still rejects a wrong password after a valid token, without ever checking the code", async () => {
    verifyPasswordMock.mockResolvedValue(false);

    const response = await POST(
      verifyTotpRequest({ email: baseUser.email, password: "wrong-password", code: "123456", turnstileToken: "fresh-token" }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" });
    expect(recordLoginFailureMock).toHaveBeenCalledWith(baseUser.email, "203.0.113.7");
    expect(verifyTotpLoginMock).not.toHaveBeenCalled();
  });
});
