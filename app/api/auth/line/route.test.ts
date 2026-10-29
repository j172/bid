import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

const { cookieSetMock } = vi.hoisted(() => ({
  cookieSetMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: cookieSetMock,
  }),
}));

describe("GET /api/auth/line", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("redirects to login with error when LINE is not configured", async () => {
    delete process.env.LINE_CHANNEL_ID;
    delete process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;
    delete process.env.LINE_CHANNEL_SECRET;

    const req = new Request("http://localhost:3000/api/auth/line");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("Location");
    expect(location).toContain("/login?error=LINE_NOT_CONFIGURED");
  });

  it("sets state cookie and redirects to LINE authorize URL when configured", async () => {
    process.env.LINE_CHANNEL_ID = "123456789";
    process.env.LINE_CHANNEL_SECRET = "secret-123";

    const req = new Request("http://localhost:3000/api/auth/line?returnTo=/listings/10");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("Location");
    expect(location).toContain("https://access.line.me/oauth2/v2.1/authorize");
    expect(location).toContain("client_id=123456789");
    expect(location).toContain("state=");

    expect(cookieSetMock).toHaveBeenCalledTimes(1);
    expect(cookieSetMock).toHaveBeenCalledWith(
      "line_auth_state",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
      }),
    );
  });
});
