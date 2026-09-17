// Issue #304: display name is now required (no more generateDefaultDisplayName()
// placeholder), LINE ID is a new required field, and a single terms-acceptance
// checkbox must be checked before an account can be created. These tests cover
// the route's own responsibility for all three — the underlying field-shape
// rules (length/regex) are covered by lib/profile.test.ts's validateProfile
// tests, not repeated here. mocks are created via vi.hoisted so they exist
// before vi.mock's factories below run — same pattern as
// app/api/auth/login/route.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createUserMock, findUserByEmailMock } = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  findUserByEmailMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  createUser: createUserMock,
  findUserByEmail: findUserByEmailMock,
}));

const {
  createEmailVerificationTokenMock,
  isEmailVerificationRateLimitedMock,
  verifyEmailPathMock,
} = vi.hoisted(() => ({
  createEmailVerificationTokenMock: vi.fn(),
  isEmailVerificationRateLimitedMock: vi.fn(),
  verifyEmailPathMock: vi.fn(),
}));

vi.mock("@/lib/emailVerification", () => ({
  createEmailVerificationToken: createEmailVerificationTokenMock,
  isEmailVerificationRateLimited: isEmailVerificationRateLimitedMock,
  verifyEmailPath: verifyEmailPathMock,
}));

const { sendVerificationEmailMock } = vi.hoisted(() => ({
  sendVerificationEmailMock: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  sendVerificationEmail: sendVerificationEmailMock,
}));

vi.mock("@/lib/clientIp", () => ({
  getClientIpFromHeaders: () => "203.0.113.7",
}));

import { POST } from "./route";

function registerRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: "visitor@example.com",
  password: "correct-password",
  displayName: "王小明",
  lineId: "pigeon_lover01",
  phone: "0912-345-678",
  address: "台北市信義區信義路一段1號",
  termsAccepted: true,
  locale: "zh-TW",
};

beforeEach(() => {
  createUserMock.mockReset();
  findUserByEmailMock.mockReset();
  findUserByEmailMock.mockResolvedValue(null);
  createUserMock.mockResolvedValue({ id: 1, email: validBody.email, role: "user" });
  createEmailVerificationTokenMock.mockReset();
  isEmailVerificationRateLimitedMock.mockReset();
  isEmailVerificationRateLimitedMock.mockResolvedValue(true); // skip the email send branch by default
  verifyEmailPathMock.mockReset();
  sendVerificationEmailMock.mockReset();
});

describe("POST /api/auth/register — display name required (issue #304)", () => {
  it("rejects a blank display name instead of generating a placeholder", async () => {
    const response = await POST(registerRequest({ ...validBody, displayName: "" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, errorCode: "DISPLAY_NAME_REQUIRED" });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only display name", async () => {
    const response = await POST(registerRequest({ ...validBody, displayName: "   " }));
    const data = await response.json();

    expect(data).toEqual({ ok: false, errorCode: "DISPLAY_NAME_REQUIRED" });
    expect(createUserMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/register — LINE ID required (issue #304)", () => {
  it("rejects a missing LINE ID", async () => {
    const response = await POST(registerRequest({ ...validBody, lineId: "" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, errorCode: "LINE_ID_REQUIRED" });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects a LINE ID with an invalid format", async () => {
    const response = await POST(registerRequest({ ...validBody, lineId: "ab" }));
    const data = await response.json();

    expect(data).toEqual({ ok: false, errorCode: "LINE_ID_INVALID_FORMAT" });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("passes a valid LINE ID through to createUser", async () => {
    await POST(registerRequest(validBody));

    expect(createUserMock).toHaveBeenCalledWith(
      validBody.email,
      validBody.password,
      { displayName: validBody.displayName, phone: validBody.phone, address: validBody.address, lineId: validBody.lineId },
      validBody.locale,
    );
  });
});

describe("POST /api/auth/register — terms acceptance checkbox (issue #304)", () => {
  it("rejects a request where termsAccepted is false", async () => {
    const response = await POST(registerRequest({ ...validBody, termsAccepted: false }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, errorCode: "TERMS_NOT_ACCEPTED" });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects a request where termsAccepted is missing entirely", async () => {
    const withoutTerms: Record<string, unknown> = { ...validBody };
    delete withoutTerms.termsAccepted;
    const response = await POST(registerRequest(withoutTerms));
    const data = await response.json();

    expect(data).toEqual({ ok: false, errorCode: "TERMS_NOT_ACCEPTED" });
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("only checks terms acceptance after profile validation has already passed", async () => {
    // Profile validation (display name) should fail first even when terms
    // are also unaccepted — confirms the route validates in that order.
    const response = await POST(registerRequest({ ...validBody, displayName: "", termsAccepted: false }));
    const data = await response.json();

    expect(data).toEqual({ ok: false, errorCode: "DISPLAY_NAME_REQUIRED" });
  });

  it("creates the account once terms are accepted", async () => {
    const response = await POST(registerRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(createUserMock).toHaveBeenCalledTimes(1);
  });
});
