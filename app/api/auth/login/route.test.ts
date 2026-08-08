// Issue #118's other explicitly-requested test: an unverified account must
// be rejected before a session is ever created, and before any 2FA branch
// even runs. Every import the route pulls in gets mocked (not just
// @/lib/db) so this never touches lib/auth.ts's real createSession — which
// calls next/headers' cookies(), unavailable outside a real request scope —
// and instead asserts directly on whether the mocked createSession was
// invoked, same "assert on the mock's calls" style lib/passwordReset.test.ts
// uses for its own DB layer. mocks are created via vi.hoisted so they exist
// before vi.mock's factories below run.
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

const { isEmailOtpRateLimitedMock, createEmailOtpChallengeMock } = vi.hoisted(() => ({
  isEmailOtpRateLimitedMock: vi.fn(),
  createEmailOtpChallengeMock: vi.fn(),
}));

vi.mock("@/lib/emailOtp", () => ({
  isEmailOtpRateLimited: isEmailOtpRateLimitedMock,
  createEmailOtpChallenge: createEmailOtpChallengeMock,
}));

vi.mock("@/lib/notifications", () => ({
  sendEmailOtpEmail: vi.fn(),
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

vi.mock("@/lib/clientIp", () => ({
  getClientIpFromHeaders: () => "203.0.113.7",
}));

import { POST } from "./route";

function loginRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
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
  two_factor_method: "none" as const,
};

beforeEach(() => {
  findUserByEmailMock.mockReset();
  verifyPasswordMock.mockReset();
  createSessionMock.mockReset();
  isLoginRateLimitedMock.mockReset();
  isLoginRateLimitedMock.mockResolvedValue(false);
  recordLoginFailureMock.mockReset();
  clearLoginFailuresMock.mockReset();
});

describe("POST /api/auth/login — email verification gate (issue #118)", () => {
  it("rejects a correct password on an unverified account with EMAIL_NOT_VERIFIED, without creating a session", async () => {
    findUserByEmailMock.mockResolvedValue({ ...baseUser, email_verified: 0 });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await POST(loginRequest({ email: baseUser.email, password: "correct-password" }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({ ok: false, errorCode: "EMAIL_NOT_VERIFIED" });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("blocks an unverified account before any 2FA challenge is issued", async () => {
    findUserByEmailMock.mockResolvedValue({ ...baseUser, email_verified: 0, two_factor_method: "email_otp" });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await POST(loginRequest({ email: baseUser.email, password: "correct-password" }));
    const data = await response.json();

    expect(data).toEqual({ ok: false, errorCode: "EMAIL_NOT_VERIFIED" });
    expect(isEmailOtpRateLimitedMock).not.toHaveBeenCalled();
    expect(createEmailOtpChallengeMock).not.toHaveBeenCalled();
  });

  it("logs a verified account in normally", async () => {
    findUserByEmailMock.mockResolvedValue({ ...baseUser, email_verified: 1 });
    verifyPasswordMock.mockResolvedValue(true);
    createSessionMock.mockResolvedValue("session-token");

    const response = await POST(loginRequest({ email: baseUser.email, password: "correct-password" }));
    const data = await response.json();

    expect(data).toEqual({ ok: true, user: { id: baseUser.id, email: baseUser.email, role: baseUser.role } });
    expect(createSessionMock).toHaveBeenCalledWith(baseUser.id);
  });

  it("still rejects a wrong password before ever checking verification status", async () => {
    findUserByEmailMock.mockResolvedValue({ ...baseUser, email_verified: 0 });
    verifyPasswordMock.mockResolvedValue(false);

    const response = await POST(loginRequest({ email: baseUser.email, password: "wrong-password" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" });
  });
});

// Issue #140 H-1: the password check itself is now rate limited. The
// counting/expiry rules live in lib/loginRateLimit.ts (and are tested there
// against an in-memory login_attempts table); these cover only what the
// route itself is responsible for — consulting the guard before touching the
// password, recording a failure, and clearing the strikes on success.
describe("POST /api/auth/login — brute-force guard (issue #140 H-1)", () => {
  it("rejects a locked-out email with 429 before the password is ever verified", async () => {
    isLoginRateLimitedMock.mockResolvedValue(true);

    const response = await POST(loginRequest({ email: baseUser.email, password: "any-password" }));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data).toEqual({ ok: false, errorCode: "LOGIN_RATE_LIMITED" });
    expect(isLoginRateLimitedMock).toHaveBeenCalledWith(baseUser.email, "203.0.113.7");
    expect(findUserByEmailMock).not.toHaveBeenCalled();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("records a failure for a wrong password", async () => {
    findUserByEmailMock.mockResolvedValue({ ...baseUser, email_verified: 1 });
    verifyPasswordMock.mockResolvedValue(false);

    const response = await POST(loginRequest({ email: baseUser.email, password: "wrong-password" }));

    expect(response.status).toBe(401);
    expect(recordLoginFailureMock).toHaveBeenCalledWith(baseUser.email, "203.0.113.7");
    expect(clearLoginFailuresMock).not.toHaveBeenCalled();
  });

  it("records a failure for an email that isn't registered at all, same as a wrong password", async () => {
    findUserByEmailMock.mockResolvedValue(null);

    const response = await POST(loginRequest({ email: "nobody@example.com", password: "guess" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" });
    expect(recordLoginFailureMock).toHaveBeenCalledWith("nobody@example.com", "203.0.113.7");
  });

  it("clears the email's strikes as soon as the correct password is accepted", async () => {
    findUserByEmailMock.mockResolvedValue({ ...baseUser, email_verified: 1 });
    verifyPasswordMock.mockResolvedValue(true);
    createSessionMock.mockResolvedValue("session-token");

    const response = await POST(loginRequest({ email: baseUser.email, password: "correct-password" }));
    const data = await response.json();

    expect(data.ok).toBe(true);
    expect(clearLoginFailuresMock).toHaveBeenCalledWith(baseUser.email);
    expect(recordLoginFailureMock).not.toHaveBeenCalled();
  });

  it("clears the strikes even when a second factor is still pending", async () => {
    findUserByEmailMock.mockResolvedValue({ ...baseUser, email_verified: 1, two_factor_method: "totp" });
    verifyPasswordMock.mockResolvedValue(true);

    const response = await POST(loginRequest({ email: baseUser.email, password: "correct-password" }));
    const data = await response.json();

    expect(data).toEqual({ ok: true, twoFactorRequired: true, twoFactorMethod: "totp" });
    expect(clearLoginFailuresMock).toHaveBeenCalledWith(baseUser.email);
  });
});
