import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { DELETE, GET, PUT } from "./route";
import { requireAdmin } from "@/lib/apiAuth";
import { deletePigeonStation, getPigeonStationById, updatePigeonStation } from "@/lib/pigeonStations";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/pigeonStations", () => ({
  getPigeonStationById: vi.fn(),
  updatePigeonStation: vi.fn(),
  deletePigeonStation: vi.fn(),
}));

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("/api/admin/pigeon-stations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("blocks non-admin access", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
      });
      const res = await GET(new Request("http://localhost"), params("1"));
      expect(res.status).toBe(401);
    });

    it("rejects an invalid id without querying the database", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      const res = await GET(new Request("http://localhost"), params("abc"));
      expect(res.status).toBe(404);
      expect(getPigeonStationById).not.toHaveBeenCalled();
    });

    it("returns 404 when not found", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(getPigeonStationById).mockResolvedValueOnce(null);
      const res = await GET(new Request("http://localhost"), params("999"));
      expect(res.status).toBe(404);
    });

    it("returns the station when found", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(getPigeonStationById).mockResolvedValueOnce({
        id: 1,
        name: "三重站",
        phone: "02-29724082",
        address: "三重區河邊北街166號",
        lat: 25.06,
        lng: 121.49,
        sourceUrl: "https://nicepigeon.com/news_detail.php?id=16",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const res = await GET(new Request("http://localhost"), params("1"));
      expect(res.status).toBe(200);
      expect((await res.json()).station.name).toBe("三重站");
    });
  });

  describe("PUT", () => {
    it("blocks non-admin access", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
      });
      const req = new Request("http://localhost", { method: "PUT", body: JSON.stringify({}) });
      const res = await PUT(req, params("1"));
      expect(res.status).toBe(401);
    });

    it("rejects an invalid id", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      const req = new Request("http://localhost", { method: "PUT", body: JSON.stringify({}) });
      const res = await PUT(req, params("0"));
      expect(res.status).toBe(404);
      expect(updatePigeonStation).not.toHaveBeenCalled();
    });

    it("rejects malformed JSON", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      const req = new Request("http://localhost", { method: "PUT", body: "{" });
      const res = await PUT(req, params("1"));
      expect(res.status).toBe(400);
    });

    it("rejects a missing field", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ phone: "02-1", address: "某路", sourceUrl: "https://example.com" }),
      });
      const res = await PUT(req, params("1"));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("請輸入取鴿站名稱");
    });

    it("updates and returns ok:true on success", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(updatePigeonStation).mockResolvedValueOnce({ ok: true });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          name: "三重站",
          phone: "02-29724082",
          address: "三重區河邊北街166號",
          sourceUrl: "https://nicepigeon.com/news_detail.php?id=16",
          lat: 25.06,
          lng: 121.49,
        }),
      });
      const res = await PUT(req, params("1"));
      expect(res.status).toBe(200);
      expect(updatePigeonStation).toHaveBeenCalledWith(1, {
        name: "三重站",
        phone: "02-29724082",
        address: "三重區河邊北街166號",
        sourceUrl: "https://nicepigeon.com/news_detail.php?id=16",
        lat: 25.06,
        lng: 121.49,
      });
    });

    it("returns 400 when updatePigeonStation returns an error", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(updatePigeonStation).mockResolvedValueOnce({ ok: false, error: "找不到這個取鴿站" });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          name: "三重站",
          phone: "02-29724082",
          address: "三重區河邊北街166號",
          sourceUrl: "https://nicepigeon.com/news_detail.php?id=16",
        }),
      });
      const res = await PUT(req, params("999"));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("找不到這個取鴿站");
    });
  });

  describe("DELETE", () => {
    it("blocks non-admin access", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
      });
      const res = await DELETE(new Request("http://localhost"), params("1"));
      expect(res.status).toBe(401);
    });

    it("rejects an invalid id", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      const res = await DELETE(new Request("http://localhost"), params("abc"));
      expect(res.status).toBe(404);
      expect(deletePigeonStation).not.toHaveBeenCalled();
    });

    it("returns 404 when deletePigeonStation reports not found", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(deletePigeonStation).mockResolvedValueOnce({ ok: false, error: "找不到這個取鴿站" });
      const res = await DELETE(new Request("http://localhost"), params("999"));
      expect(res.status).toBe(404);
    });

    it("deletes and returns ok:true on success", async () => {
      vi.mocked(requireAdmin).mockResolvedValueOnce({
        user: { id: 1, email: "admin@example.com", role: "admin" },
      });
      vi.mocked(deletePigeonStation).mockResolvedValueOnce({ ok: true });
      const res = await DELETE(new Request("http://localhost"), params("1"));
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });
  });
});
