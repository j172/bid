import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

const {
  cookieGetMock,
  cookieSetMock,
  cookieDeleteMock,
  findUserByLineUserIdMock,
  createSessionMock,
  getCurrentUserMock,
  linkLineUserIdMock,
  issueLineAccessTokenMock,
  verifyLineIdTokenMock,
  getLineProfileMock,
} = vi.hoisted(() => ({
  cookieGetMock: vi.fn(),
  cookieSetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
  findUserByLineUserIdMock: vi.fn(),
  createSessionMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  linkLineUserIdMock: vi.fn(),
  issueLineAccessTokenMock: vi.fn(),
  verifyLineIdTokenMock: vi.fn(),
  getLineProfileMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: cookieGetMock,
    set: cookieSetMock,
    delete: cookieDeleteMock,
  }),
}));

vi.mock("@/lib/auth", () => ({
  findUserByLineUserId: findUserByLineUserIdMock,
  createSession: createSessionMock,
  getCurrentUser: getCurrentUserMock,
  linkLineUserId: linkLineUserIdMock,
}));

vi.mock("@/lib/lineAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lineAuth")>();
  return {
    ...actual,
    issueLineAccessToken: issueLineAccessTokenMock,
    verifyLineIdToken: verifyLineIdTokenMock,
    getLineProfile: getLineProfileMock,
  };
});

describe("GET /api/auth/line/callback", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.LINE_CHANNEL_ID = "123456789";
    process.env.LINE_CHANNEL_SECRET = "secret";
    vi.clearAllMocks();
  });

  it("redirects to login when error param or state is invalid", async () => {
    cookieGetMock.mockReturnValue(undefined);

    const req = new Request("http://localhost:3000/api/auth/line/callback?error=access_denied");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/login?error=LINE_AUTH_FAILED");
  });

  it("redirects to returnTo when user already exists with line_user_id", async () => {
    const { createLineAuthState } = await import("@/lib/lineAuth");
    const validState = createLineAuthState("/listings/99");
    cookieGetMock.mockReturnValue({ value: validState });

    issueLineAccessTokenMock.mockResolvedValueOnce({
      access_token: "mock-access",
      id_token: "mock-id-token",
    });
    verifyLineIdTokenMock.mockResolvedValueOnce({
      sub: "U123456",
      name: "Existing Line User",
    });
    findUserByLineUserIdMock.mockResolvedValueOnce({
      id: 8,
      email: "user@example.com",
      suspended_at: null,
    });

    const req = new Request(
      `http://localhost:3000/api/auth/line/callback?code=good-code&state=${encodeURIComponent(validState)}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/listings/99");
    expect(createSessionMock).toHaveBeenCalledWith(8);
    expect(cookieDeleteMock).toHaveBeenCalledWith("line_auth_state");
  });

  it("redirects to login with error when existing user is suspended", async () => {
    const { createLineAuthState } = await import("@/lib/lineAuth");
    const validState = createLineAuthState("/account");
    cookieGetMock.mockReturnValue({ value: validState });

    issueLineAccessTokenMock.mockResolvedValueOnce({
      access_token: "mock-access",
      id_token: "mock-id-token",
    });
    verifyLineIdTokenMock.mockResolvedValueOnce({
      sub: "U-suspended",
    });
    findUserByLineUserIdMock.mockResolvedValueOnce({
      id: 9,
      suspended_at: new Date(),
    });

    const req = new Request(
      `http://localhost:3000/api/auth/line/callback?code=good-code&state=${encodeURIComponent(validState)}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/login?error=ACCOUNT_SUSPENDED");
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("links LINE account when user is already logged in", async () => {
    const { createLineAuthState } = await import("@/lib/lineAuth");
    const validState = createLineAuthState("/account");
    cookieGetMock.mockReturnValue({ value: validState });

    issueLineAccessTokenMock.mockResolvedValueOnce({
      access_token: "mock-access",
      id_token: "mock-id-token",
    });
    verifyLineIdTokenMock.mockResolvedValueOnce({
      sub: "U-new-link",
    });
    findUserByLineUserIdMock.mockResolvedValueOnce(null);
    getCurrentUserMock.mockResolvedValueOnce({
      id: 15,
      email: "existing@example.com",
    });

    const req = new Request(
      `http://localhost:3000/api/auth/line/callback?code=good-code&state=${encodeURIComponent(validState)}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/account?lineLinked=true");
    expect(linkLineUserIdMock).toHaveBeenCalledWith(15, "U-new-link");
  });

  it("sets onboarding cookie and redirects to /register/line for new user", async () => {
    const { createLineAuthState } = await import("@/lib/lineAuth");
    const validState = createLineAuthState("/");
    cookieGetMock.mockReturnValue({ value: validState });

    issueLineAccessTokenMock.mockResolvedValueOnce({
      access_token: "mock-access",
      id_token: "mock-id-token",
    });
    verifyLineIdTokenMock.mockResolvedValueOnce({
      sub: "U-new-visitor",
      name: "Newbie",
      email: "newbie@example.com",
    });
    findUserByLineUserIdMock.mockResolvedValueOnce(null);
    getCurrentUserMock.mockResolvedValueOnce(null);

    const req = new Request(
      `http://localhost:3000/api/auth/line/callback?code=good-code&state=${encodeURIComponent(validState)}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/register/line");
    expect(cookieSetMock).toHaveBeenCalledWith(
      "line_onboard",
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
