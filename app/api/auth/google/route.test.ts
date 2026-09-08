import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { verifyGoogleIdTokenMock, authenticateWithGooglePayloadMock } = vi.hoisted(() => ({
  verifyGoogleIdTokenMock: vi.fn(),
  authenticateWithGooglePayloadMock: vi.fn(),
}));

vi.mock("@/lib/googleAuth", () => ({
  verifyGoogleIdToken: verifyGoogleIdTokenMock,
  authenticateWithGooglePayload: authenticateWithGooglePayloadMock,
}));

vi.mock("@/lib/clientIp", () => ({
  getClientIpFromHeaders: () => "127.0.0.1",
}));

describe("POST /api/auth/google", () => {
  it("rejects request without credential", async () => {
    const req = new Request("http://localhost/api/auth/google", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ ok: false, errorCode: "GOOGLE_AUTH_FAILED" });
  });

  it("returns 401 when Google token verification fails", async () => {
    verifyGoogleIdTokenMock.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: "invalid-token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ ok: false, errorCode: "GOOGLE_AUTH_FAILED" });
  });

  it("returns 200 with user info upon successful authentication", async () => {
    verifyGoogleIdTokenMock.mockResolvedValueOnce({
      sub: "google-123",
      email: "user@example.com",
      email_verified: true,
      name: "Google User",
    });
    authenticateWithGooglePayloadMock.mockResolvedValueOnce({
      ok: true,
      twoFactorRequired: false,
      user: { id: 7, email: "user@example.com", role: "user" },
    });

    const req = new Request("http://localhost/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: "valid-token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      user: { id: 7, email: "user@example.com", role: "user" },
    });
  });

  it("returns 200 with twoFactorRequired when 2FA is needed", async () => {
    verifyGoogleIdTokenMock.mockResolvedValueOnce({
      sub: "google-123",
      email: "user@example.com",
      email_verified: true,
    });
    authenticateWithGooglePayloadMock.mockResolvedValueOnce({
      ok: true,
      twoFactorRequired: true,
      twoFactorMethod: "email_otp",
      challengeToken: "otp-token-123",
    });

    const req = new Request("http://localhost/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: "valid-token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      twoFactorRequired: true,
      twoFactorMethod: "email_otp",
      challengeToken: "otp-token-123",
    });
  });

  it("returns 403 when user is suspended", async () => {
    verifyGoogleIdTokenMock.mockResolvedValueOnce({
      sub: "google-123",
      email: "user@example.com",
      email_verified: true,
    });
    authenticateWithGooglePayloadMock.mockResolvedValueOnce({
      ok: false,
      errorCode: "ACCOUNT_SUSPENDED",
    });

    const req = new Request("http://localhost/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential: "valid-token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json).toEqual({ ok: false, errorCode: "ACCOUNT_SUSPENDED" });
  });
});
