import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";

const {
  cookieGetMock,
  cookieDeleteMock,
  createLineUserMock,
  createSessionMock,
  findUserByEmailMock,
} = vi.hoisted(() => ({
  cookieGetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
  createLineUserMock: vi.fn(),
  createSessionMock: vi.fn(),
  findUserByEmailMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: cookieGetMock,
    delete: cookieDeleteMock,
  }),
}));

vi.mock("@/lib/auth", () => ({
  createLineUser: createLineUserMock,
  createSession: createSessionMock,
  findUserByEmail: findUserByEmailMock,
}));

describe("POST /api/auth/line/complete-registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if onboarding cookie is missing", async () => {
    cookieGetMock.mockReturnValue(undefined);

    const req = new Request("http://localhost/api/auth/line/complete-registration", {
      method: "POST",
      body: JSON.stringify({ displayName: "Test", email: "a@b.com", phone: "0912345678", termsAccepted: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ ok: false, errorCode: "LINE_ONBOARD_EXPIRED" });
  });

  it("validates required fields (termsAccepted, phone, email)", async () => {
    const { createLineOnboardToken } = await import("@/lib/lineAuth");
    const validToken = createLineOnboardToken({ lineUserId: "U12345" });
    cookieGetMock.mockReturnValue({ value: validToken });

    // Missing terms accepted
    const req = new Request("http://localhost/api/auth/line/complete-registration", {
      method: "POST",
      body: JSON.stringify({
        displayName: "User",
        email: "user@example.com",
        phone: "0912345678",
        termsAccepted: false,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errorCode).toBe("TERMS_NOT_ACCEPTED");
  });

  it("returns 409 if email already exists, prompting linking", async () => {
    const { createLineOnboardToken } = await import("@/lib/lineAuth");
    const validToken = createLineOnboardToken({ lineUserId: "U12345" });
    cookieGetMock.mockReturnValue({ value: validToken });

    findUserByEmailMock.mockResolvedValueOnce({ id: 1, email: "existing@example.com" });

    const req = new Request("http://localhost/api/auth/line/complete-registration", {
      method: "POST",
      body: JSON.stringify({
        displayName: "User",
        email: "existing@example.com",
        phone: "0912345678",
        termsAccepted: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      errorCode: "EMAIL_ALREADY_REGISTERED",
      requireLink: true,
    });
  });

  it("creates user and logs in on valid input", async () => {
    const { createLineOnboardToken } = await import("@/lib/lineAuth");
    const validToken = createLineOnboardToken({ lineUserId: "U12345", displayName: "Line Nickname" });
    cookieGetMock.mockReturnValue({ value: validToken });

    findUserByEmailMock.mockResolvedValueOnce(null);
    createLineUserMock.mockResolvedValueOnce({ id: 10, email: "new@example.com", role: "user" });

    const req = new Request("http://localhost/api/auth/line/complete-registration", {
      method: "POST",
      body: JSON.stringify({
        displayName: "Line Nickname",
        email: "new@example.com",
        phone: "0912-345-678",
        termsAccepted: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      user: { id: 10, email: "new@example.com", role: "user" },
    });
    expect(createSessionMock).toHaveBeenCalledWith(10);
    expect(cookieDeleteMock).toHaveBeenCalledWith("line_onboard");
  });
});
