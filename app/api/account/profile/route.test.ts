// Issue #304: /account gains a LINE ID field so already-registered users can
// fill in / correct the one now required at registration. These tests cover
// only the route's own responsibility (auth gate, validation via the shared
// validateProfile(), passing lineId through to updateProfile) — the field
// rules themselves are covered by lib/profile.test.ts. @/lib/auth is mocked
// wholesale (both getCurrentUser, consumed indirectly via lib/apiAuth's
// requireUser, and updateProfile) so this never touches next/headers'
// cookies() or a real database — same pattern as
// app/api/auth/login/route.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock, updateProfileMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  updateProfileMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
  updateProfile: updateProfileMock,
}));

import { POST } from "./route";

function profileRequest(body: unknown) {
  return new Request("http://localhost/api/account/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const currentUser = { id: 42, email: "visitor@example.com", role: "user" as const };

const validBody = {
  displayName: "王小明",
  phone: "0912-345-678",
  address: "台北市信義區信義路一段1號",
  lineId: "pigeon_lover01",
};

beforeEach(() => {
  getCurrentUserMock.mockReset();
  getCurrentUserMock.mockResolvedValue(currentUser);
  updateProfileMock.mockReset();
});

describe("POST /api/account/profile — auth gate", () => {
  it("rejects a logged-out visitor without validating anything", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const response = await POST(profileRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ ok: false, errorCode: "MUST_LOGIN" });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/account/profile — LINE ID (issue #304)", () => {
  it("rejects a missing LINE ID", async () => {
    const response = await POST(profileRequest({ ...validBody, lineId: "" }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ ok: false, errorCode: "LINE_ID_REQUIRED" });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid LINE ID format", async () => {
    const response = await POST(profileRequest({ ...validBody, lineId: "!!" }));
    const data = await response.json();

    expect(data).toEqual({ ok: false, errorCode: "LINE_ID_INVALID_FORMAT" });
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("saves a valid LINE ID alongside the rest of the profile", async () => {
    const response = await POST(profileRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(updateProfileMock).toHaveBeenCalledWith(currentUser.id, validBody);
  });
});
