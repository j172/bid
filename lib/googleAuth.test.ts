import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateWithGooglePayload,
  createGoogle2faChallenge,
  verifyGoogle2faChallenge,
  type GooglePayload,
} from "./googleAuth";

const {
  findUserByEmailMock,
  findUserByGoogleIdMock,
  linkGoogleIdMock,
  createGoogleUserMock,
  createSessionMock,
  createEmailOtpChallengeMock,
  sendEmailOtpEmailMock,
  isEmailOtpRateLimitedMock,
} = vi.hoisted(() => ({
  findUserByEmailMock: vi.fn(),
  findUserByGoogleIdMock: vi.fn(),
  linkGoogleIdMock: vi.fn(),
  createGoogleUserMock: vi.fn(),
  createSessionMock: vi.fn(),
  createEmailOtpChallengeMock: vi.fn(),
  sendEmailOtpEmailMock: vi.fn(),
  isEmailOtpRateLimitedMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  findUserByEmail: findUserByEmailMock,
  findUserByGoogleId: findUserByGoogleIdMock,
  linkGoogleId: linkGoogleIdMock,
  createGoogleUser: createGoogleUserMock,
  createSession: createSessionMock,
}));

vi.mock("@/lib/emailOtp", () => ({
  createEmailOtpChallenge: createEmailOtpChallengeMock,
  isEmailOtpRateLimited: isEmailOtpRateLimitedMock,
}));

vi.mock("@/lib/notifications", () => ({
  sendEmailOtpEmail: sendEmailOtpEmailMock,
}));

describe("lib/googleAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Google 2FA Challenge Token", () => {
    it("generates and verifies a valid challenge token", () => {
      const token = createGoogle2faChallenge(42, "user@example.com");
      expect(typeof token).toBe("string");

      const verified = verifyGoogle2faChallenge(token);
      expect(verified).toEqual({ userId: 42, email: "user@example.com" });
    });

    it("rejects tampered challenge token", () => {
      const token = createGoogle2faChallenge(42, "user@example.com");
      const tampered = token.slice(0, -4) + "abcd";
      expect(verifyGoogle2faChallenge(tampered)).toBeNull();
    });

    it("rejects invalid format challenge token", () => {
      expect(verifyGoogle2faChallenge("invalid-token")).toBeNull();
    });
  });

  describe("authenticateWithGooglePayload", () => {
    const basePayload: GooglePayload = {
      sub: "google-12345",
      email: "test@example.com",
      email_verified: true,
      name: "Test User",
    };

    it("rejects unverified Google email", async () => {
      const result = await authenticateWithGooglePayload(
        { ...basePayload, email_verified: false },
        "zh-TW",
        "127.0.0.1",
      );
      expect(result).toEqual({ ok: false, errorCode: "EMAIL_NOT_VERIFIED" });
      expect(createSessionMock).not.toHaveBeenCalled();
    });

    it("auto-registers brand new user and creates session", async () => {
      findUserByGoogleIdMock.mockResolvedValueOnce(null);
      findUserByEmailMock.mockResolvedValueOnce(null);
      createGoogleUserMock.mockResolvedValueOnce({
        id: 101,
        email: "test@example.com",
        role: "user",
      });

      const result = await authenticateWithGooglePayload(basePayload, "zh-TW", "127.0.0.1");
      expect(result).toEqual({
        ok: true,
        twoFactorRequired: false,
        user: { id: 101, email: "test@example.com", role: "user" },
      });
      expect(createGoogleUserMock).toHaveBeenCalledWith({
        email: "test@example.com",
        googleId: "google-12345",
        displayName: "Test User",
        locale: "zh-TW",
      });
      expect(createSessionMock).toHaveBeenCalledWith(101);
    });

    it("links google_id and signs in existing user by email", async () => {
      findUserByGoogleIdMock.mockResolvedValueOnce(null);
      findUserByEmailMock.mockResolvedValueOnce({
        id: 50,
        email: "test@example.com",
        google_id: null,
        role: "user",
        suspended_at: null,
        two_factor_method: "none",
      });

      const result = await authenticateWithGooglePayload(basePayload, "zh-TW", "127.0.0.1");
      expect(linkGoogleIdMock).toHaveBeenCalledWith(50, "google-12345");
      expect(createSessionMock).toHaveBeenCalledWith(50);
      expect(result).toEqual({
        ok: true,
        twoFactorRequired: false,
        user: { id: 50, email: "test@example.com", role: "user" },
      });
    });

    it("blocks suspended user from logging in", async () => {
      findUserByGoogleIdMock.mockResolvedValueOnce({
        id: 50,
        email: "test@example.com",
        google_id: "google-12345",
        role: "user",
        suspended_at: new Date(),
        two_factor_method: "none",
      });

      const result = await authenticateWithGooglePayload(basePayload, "zh-TW", "127.0.0.1");
      expect(result).toEqual({ ok: false, errorCode: "ACCOUNT_SUSPENDED" });
      expect(createSessionMock).not.toHaveBeenCalled();
    });

    it("triggers Email OTP 2FA when user has two_factor_method = email_otp", async () => {
      findUserByGoogleIdMock.mockResolvedValueOnce({
        id: 50,
        email: "test@example.com",
        google_id: "google-12345",
        role: "user",
        locale: "zh-TW",
        suspended_at: null,
        two_factor_method: "email_otp",
      });
      isEmailOtpRateLimitedMock.mockResolvedValueOnce(false);
      createEmailOtpChallengeMock.mockResolvedValueOnce({ token: "challenge-otp-123", code: "654321" });

      const result = await authenticateWithGooglePayload(basePayload, "zh-TW", "127.0.0.1");
      expect(result).toEqual({
        ok: true,
        twoFactorRequired: true,
        twoFactorMethod: "email_otp",
        challengeToken: "challenge-otp-123",
      });
      expect(sendEmailOtpEmailMock).toHaveBeenCalledWith("test@example.com", "zh-TW", "654321");
      expect(createSessionMock).not.toHaveBeenCalled();
    });

    it("triggers TOTP challenge when user has two_factor_method = totp", async () => {
      findUserByGoogleIdMock.mockResolvedValueOnce({
        id: 50,
        email: "test@example.com",
        google_id: "google-12345",
        role: "user",
        suspended_at: null,
        two_factor_method: "totp",
      });

      const result = await authenticateWithGooglePayload(basePayload, "zh-TW", "127.0.0.1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.twoFactorRequired).toBe(true);
        if (result.twoFactorRequired) {
          expect(result.twoFactorMethod).toBe("totp");
          expect(result.challengeToken).toBeDefined();
          expect(verifyGoogle2faChallenge(result.challengeToken)).toEqual({
            userId: 50,
            email: "test@example.com",
          });
        }
      }
      expect(createSessionMock).not.toHaveBeenCalled();
    });
  });
});
