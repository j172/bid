import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";

const { getCurrentUserMock, unlinkLineUserIdMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  unlinkLineUserIdMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
  unlinkLineUserId: unlinkLineUserIdMock,
}));

describe("POST /api/auth/line/unlink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not logged in", async () => {
    getCurrentUserMock.mockResolvedValueOnce(null);

    const res = await POST();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json).toEqual({ ok: false, errorCode: "MUST_LOGIN" });
  });

  it("returns 400 when unlinking fails (e.g. only login method)", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ id: 2, email: "lineonly@example.com" });
    unlinkLineUserIdMock.mockResolvedValueOnce({
      ok: false,
      errorCode: "CANNOT_UNLINK_ONLY_LOGIN_METHOD",
    });

    const res = await POST();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ ok: false, errorCode: "CANNOT_UNLINK_ONLY_LOGIN_METHOD" });
  });

  it("returns 200 when unlinking succeeds", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ id: 2, email: "user@example.com" });
    unlinkLineUserIdMock.mockResolvedValueOnce({ ok: true });

    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    expect(unlinkLineUserIdMock).toHaveBeenCalledWith(2);
  });
});
