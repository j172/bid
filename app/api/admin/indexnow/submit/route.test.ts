import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";
import { requireAdmin } from "@/lib/apiAuth";
import { submitToIndexNow } from "@/lib/indexnow";
import type { CurrentUser } from "@/lib/auth";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/indexnow", () => ({
  submitToIndexNow: vi.fn(),
}));

vi.mock("@/lib/listings", () => ({
  listOpenListings: vi.fn().mockResolvedValue([{ id: 10 }]),
}));

vi.mock("@/lib/news", () => ({
  listNewsForSitemap: vi.fn().mockResolvedValue([{ id: 2 }]),
}));

describe("POST /api/admin/indexnow/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks non-admin access with 401/403", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
    });

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("gathers key URLs and triggers submitToIndexNow successfully", async () => {
    const adminUser: CurrentUser = { id: 1, email: "admin@example.com", role: "admin" };
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      user: adminUser,
    });

    vi.mocked(submitToIndexNow).mockResolvedValueOnce({
      ok: true,
      count: 25,
      status: 200,
    });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(25);
    expect(submitToIndexNow).toHaveBeenCalledTimes(1);

    const submittedUrls = vi.mocked(submitToIndexNow).mock.calls[0][0];
    expect(submittedUrls.some((u) => u.includes("/listings/10"))).toBe(true);
    expect(submittedUrls.some((u) => u.includes("/news/2"))).toBe(true);
    expect(submittedUrls.some((u) => u === "https://xiangshuicn.cc/")).toBe(true);
  });
});
