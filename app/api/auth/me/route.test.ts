import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
}));

describe("GET /api/auth/me", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("returns user and trimmed NEXT_PUBLIC_GOOGLE_CLIENT_ID when set", async () => {
    getCurrentUserMock.mockResolvedValue({ id: 5, email: "pigeon@example.com", role: "user" });
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "  public-client-id.apps.googleusercontent.com  ";
    process.env.GOOGLE_CLIENT_ID = "fallback-client-id.apps.googleusercontent.com";

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      user: { id: 5, email: "pigeon@example.com", role: "user" },
      googleClientId: "public-client-id.apps.googleusercontent.com",
    });
  });

  it("falls back to trimmed GOOGLE_CLIENT_ID when NEXT_PUBLIC_GOOGLE_CLIENT_ID is blank or unset", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "   ";
    process.env.GOOGLE_CLIENT_ID = "  server-client-id.apps.googleusercontent.com\n";

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      user: null,
      googleClientId: "server-client-id.apps.googleusercontent.com",
    });
  });

  it("returns googleClientId: null when neither env var is configured", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      user: null,
      googleClientId: null,
    });
  });
});
