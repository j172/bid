import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/apiAuth";
import { createPigeonStation, listPigeonStations } from "@/lib/pigeonStations";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/pigeonStations", () => ({
  listPigeonStations: vi.fn(),
  createPigeonStation: vi.fn(),
}));

describe("/api/admin/pigeon-stations", () => {
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

    it("returns list of stations for admin", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(listPigeonStations).mockResolvedValueOnce([
        {
          id: 1,
          name: "三重站",
          phone: "02-29724082",
          address: "三重區河邊北街166號",
          lat: 25.06,
          lng: 121.49,
          sourceUrl: "https://nicepigeon.com/news_detail.php?id=16",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.stations).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("blocks non-admin access", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
      });

      const req = new Request("http://localhost/api/admin/pigeon-stations", {
        method: "POST",
        body: JSON.stringify({ name: "測試站" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects malformed JSON", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      const res = await POST(new Request("http://localhost", { method: "POST", body: "{" }));
      expect(res.status).toBe(400);
      expect(createPigeonStation).not.toHaveBeenCalled();
    });

    it("rejects a missing required field before calling createPigeonStation", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      const req = new Request("http://localhost/api/admin/pigeon-stations", {
        method: "POST",
        body: JSON.stringify({ phone: "02-1234", address: "某路1號", sourceUrl: "https://example.com" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("請輸入取鴿站名稱");
      expect(createPigeonStation).not.toHaveBeenCalled();
    });

    it("rejects a non-numeric lat", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      const req = new Request("http://localhost/api/admin/pigeon-stations", {
        method: "POST",
        body: JSON.stringify({
          name: "測試站",
          phone: "02-1234",
          address: "某路1號",
          sourceUrl: "https://example.com",
          lat: "not-a-number",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("緯度格式錯誤");
    });

    it("creates a station with null lat/lng when omitted, and returns 200 on success", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(createPigeonStation).mockResolvedValueOnce({ ok: true, id: 9 });

      const req = new Request("http://localhost/api/admin/pigeon-stations", {
        method: "POST",
        body: JSON.stringify({
          name: "測試站",
          phone: "02-1234",
          address: "某路1號",
          sourceUrl: "https://example.com",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true, id: 9 });
      expect(createPigeonStation).toHaveBeenCalledWith({
        name: "測試站",
        phone: "02-1234",
        address: "某路1號",
        sourceUrl: "https://example.com",
        lat: null,
        lng: null,
      });
    });

    it("returns 400 when createPigeonStation returns an error", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(createPigeonStation).mockResolvedValueOnce({ ok: false, error: "緯度必須介於 -90 到 90 之間" });

      const req = new Request("http://localhost/api/admin/pigeon-stations", {
        method: "POST",
        body: JSON.stringify({
          name: "測試站",
          phone: "02-1234",
          address: "某路1號",
          sourceUrl: "https://example.com",
          lat: 999,
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("緯度必須介於 -90 到 90 之間");
    });
  });
});
