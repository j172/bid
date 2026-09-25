import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";

const {
  cookieGetMock,
  cookieDeleteMock,
  createSessionMock,
  findUserByEmailMock,
  linkLineUserIdMock,
  verifyCurrentPasswordMock,
} = vi.hoisted(() => ({
  cookieGetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
  createSessionMock: vi.fn(),
  findUserByEmailMock: vi.fn(),
  linkLineUserIdMock: vi.fn(),
  verifyCurrentPasswordMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: cookieGetMock,
    delete: cookieDeleteMock,
  }),
}));

vi.mock("@/lib/auth", () => ({
  createSession: createSessionMock,
  findUserByEmail: findUserByEmailMock,
  linkLineUserId: linkLineUserIdMock,
  verifyCurrentPassword: verifyCurrentPasswordMock,
}));

describe("POST /api/auth/line/link-existing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when onboarding cookie is missing", async () => {
    cookieGetMock.mockReturnValue(undefined);

    const req = new Request("http://localhost/api/auth/line/link-existing", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "password123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when password is wrong", async () => {
    const { createLineOnboardToken } = await import("@/lib/lineAuth");
    const validToken = createLineOnboardToken({ lineUserId: "U12345" });
    cookieGetMock.mockReturnValue({ value: validToken });

    findUserByEmailMock.mockResolvedValueOnce({ id: 5, email: "user@example.com", suspended_at: null });
    verifyCurrentPasswordMock.mockResolvedValueOnce(false);

    const req = new Request("http://localhost/api/auth/line/link-existing", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "wrong-password" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errorCode).toBe("EMAIL_OR_PASSWORD_INCORRECT");
    expect(linkLineUserIdMock).not.toHaveBeenCalled();
  });

  it("links line_user_id and logs in when password is correct", async () => {
    const { createLineOnboardToken } = await import("@/lib/lineAuth");
    const validToken = createLineOnboardToken({ lineUserId: "U-link-target" });
    cookieGetMock.mockReturnValue({ value: validToken });

    findUserByEmailMock.mockResolvedValueOnce({
      id: 5,
      email: "user@example.com",
      role: "user",
      suspended_at: null,
    });
    verifyCurrentPasswordMock.mockResolvedValueOnce(true);

    const req = new Request("http://localhost/api/auth/line/link-existing", {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com", password: "correct-password" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      user: { id: 5, email: "user@example.com", role: "user" },
    });

    expect(linkLineUserIdMock).toHaveBeenCalledWith(5, "U-link-target");
    expect(createSessionMock).toHaveBeenCalledWith(5);
    expect(cookieDeleteMock).toHaveBeenCalledWith("line_onboard");
  });
});
