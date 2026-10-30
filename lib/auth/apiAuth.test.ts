// The two guards every app/api route handler now goes through (issue #139
// H1/H2). getCurrentUser is mocked (it reads next/headers' cookies(), which
// only resolves inside a real request scope) — same "mock the module, assert
// on the response" style as app/api/auth/login/route.test.ts. The point of
// these tests is the status codes: before the guards existed, 30+ admin
// routes answered a logged-out visitor with 403 instead of 401.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUserMock } = vi.hoisted(() => ({ getCurrentUserMock: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: getCurrentUserMock,
}));

import { requireAdmin, requireUser } from "./apiAuth";

const visitor = { id: 7, email: "visitor@example.com", role: "user" as const };
const admin = { id: 1, email: "admin@example.com", role: "admin" as const };

beforeEach(() => {
  getCurrentUserMock.mockReset();
});

describe("requireUser", () => {
  it("passes the logged-in user through with no response", async () => {
    getCurrentUserMock.mockResolvedValue(visitor);

    const result = await requireUser();

    expect(result.response).toBeUndefined();
    expect(result.user).toEqual(visitor);
  });

  it("answers 401 MUST_LOGIN when nobody is logged in", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const result = await requireUser();

    expect(result.user).toBeUndefined();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({ ok: false, errorCode: "MUST_LOGIN" });
  });

  it("does not care about the role — any logged-in visitor is allowed", async () => {
    getCurrentUserMock.mockResolvedValue(admin);

    const result = await requireUser();

    expect(result.response).toBeUndefined();
    expect(result.user).toEqual(admin);
  });
});

describe("requireAdmin", () => {
  it("passes an admin through with no response", async () => {
    getCurrentUserMock.mockResolvedValue(admin);

    const result = await requireAdmin();

    expect(result.response).toBeUndefined();
    expect(result.user).toEqual(admin);
  });

  it("answers 401 (not 403) when nobody is logged in", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const result = await requireAdmin();

    expect(result.user).toBeUndefined();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({ ok: false, error: "請先登入" });
  });

  it("answers 403 for a logged-in non-admin", async () => {
    getCurrentUserMock.mockResolvedValue(visitor);

    const result = await requireAdmin();

    expect(result.user).toBeUndefined();
    expect(result.response?.status).toBe(403);
    await expect(result.response?.json()).resolves.toEqual({ ok: false, error: "僅限管理員" });
  });
});
