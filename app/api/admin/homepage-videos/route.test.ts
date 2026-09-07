import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/apiAuth";
import { createHomepageVideo, listHomepageVideos } from "@/lib/homepageVideos";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/homepageVideos", () => ({
  listHomepageVideos: vi.fn(),
  createHomepageVideo: vi.fn(),
}));

describe("/api/admin/homepage-videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("blocks non-admin access", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
      });

      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns list of videos for admin", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(listHomepageVideos).mockResolvedValueOnce([
        {
          id: 1,
          title: "影音 1",
          youtubeUrl: "https://youtu.be/123",
          videoId: "123",
          sortOrder: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.videos).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("blocks non-admin access", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
      });

      const req = new Request("http://localhost/api/admin/homepage-videos", {
        method: "POST",
        body: JSON.stringify({ title: "Test", youtubeUrl: "https://youtu.be/123" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("validates missing title", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });

      const req = new Request("http://localhost/api/admin/homepage-videos", {
        method: "POST",
        body: JSON.stringify({ title: "   ", youtubeUrl: "https://youtu.be/123" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("請輸入影片標題");
    });

    it("validates missing youtubeUrl", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });

      const req = new Request("http://localhost/api/admin/homepage-videos", {
        method: "POST",
        body: JSON.stringify({ title: "測試標題", youtubeUrl: "" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("請輸入 YouTube 影片網址");
    });

    it("creates video and returns 200 on success", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(createHomepageVideo).mockResolvedValueOnce({ ok: true, id: 5 });

      const req = new Request("http://localhost/api/admin/homepage-videos", {
        method: "POST",
        body: JSON.stringify({
          title: "精選影片",
          youtubeUrl: "https://www.youtube.com/watch?v=vy4lQXW-TLM",
          sortOrder: 1,
          isActive: true,
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.id).toBe(5);
    });

    it("returns 400 when createHomepageVideo returns error", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(createHomepageVideo).mockResolvedValueOnce({
        ok: false,
        error: "最多只能設定 6 則指定影音，請先刪除或編輯現有影音",
      });

      const req = new Request("http://localhost/api/admin/homepage-videos", {
        method: "POST",
        body: JSON.stringify({
          title: "第七部影片",
          youtubeUrl: "https://www.youtube.com/watch?v=vy4lQXW-TLM",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toContain("最多只能設定 6 則");
    });
  });
});

