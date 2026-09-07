import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "./route";

import { requireAdmin } from "@/lib/apiAuth";
import {
  deleteHomepageVideo,
  getHomepageVideo,
  updateHomepageVideo,
} from "@/lib/homepageVideos";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/homepageVideos", () => ({
  getHomepageVideo: vi.fn(),
  updateHomepageVideo: vi.fn(),
  deleteHomepageVideo: vi.fn(),
}));

describe("/api/admin/homepage-videos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 404 on invalid id param", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "invalid" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns video when found", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(getHomepageVideo).mockResolvedValueOnce({
        id: 1,
        title: "影片 1",
        youtubeUrl: "https://youtu.be/123",
        videoId: "123",
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.video.id).toBe(1);
    });
  });

  describe("PUT", () => {
    it("updates video successfully", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(updateHomepageVideo).mockResolvedValueOnce({ ok: true });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          title: "新標題",
          youtubeUrl: "https://youtu.be/abc",
          sortOrder: 2,
          isActive: false,
        }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("returns 400 when title is empty", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          title: "",
          youtubeUrl: "https://youtu.be/abc",
          sortOrder: 0,
          isActive: true,
        }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("請輸入影片標題");
    });
  });

  describe("DELETE", () => {
    it("deletes video successfully", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(deleteHomepageVideo).mockResolvedValueOnce({ ok: true });

      const res = await DELETE(new Request("http://localhost"), {
        params: Promise.resolve({ id: "1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });
  });
});
