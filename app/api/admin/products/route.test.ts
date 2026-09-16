// Mocks the auth guard, the DB-backed lib/products.ts and the filesystem-
// backed lib/uploads.ts (same split as app/api/admin/homepage-videos/
// route.test.ts), but NOT lib/productPhotoOrder.ts / lib/productValidation.ts
// — those are pure and exercised for real here, so these tests also cover
// real request parsing/validation, not just error propagation.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/apiAuth";
import { createProduct, deleteProduct, listProducts, replaceProductPhotos } from "@/lib/products";
import { deleteProductPhotoFiles, saveProductPhotos } from "@/lib/uploads";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/products", () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  replaceProductPhotos: vi.fn(),
}));

vi.mock("@/lib/uploads", () => ({
  saveProductPhotos: vi.fn(),
  deleteProductPhotoFiles: vi.fn(),
  productPhotoUrl: (productId: number, fileName: string) => `/uploads/products/${productId}/${fileName}`,
}));

const adminAuth = { user: { id: 1, email: "admin@example.com", role: "admin" as const } };

function buildCreateForm(overrides: Record<string, string> = {}, photos: File[] = [new File(["x"], "a.webp")]) {
  const form = new FormData();
  form.set("title", overrides.title ?? "限量特惠鴿");
  form.set("priceText", overrides.priceText ?? "NT$12,000");
  form.set("description", overrides.description ?? "簡介內容");
  if (overrides.sortOrder !== undefined) form.set("sortOrder", overrides.sortOrder);
  if (overrides.isActive !== undefined) form.set("isActive", overrides.isActive);
  if (overrides.youtubeUrl !== undefined) form.set("youtubeUrl", overrides.youtubeUrl);
  form.set(
    "order",
    overrides.order ?? JSON.stringify(photos.map((_, index) => ({ type: "new", index, isCover: index === 0 }))),
  );
  for (const photo of photos) form.append("photos", photo);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/products", () => {
  it("blocks non-admin access", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
    });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns products with photo URLs attached", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(listProducts).mockResolvedValueOnce([
      {
        id: 1,
        title: "t",
        priceText: "NT$1",
        description: "d",
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        youtubeUrl: null,
        photos: [{ id: 10, fileName: "a.webp", sortOrder: 0, isCover: true }],
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.products[0].photos[0].url).toBe("/uploads/products/1/a.webp");
  });
});

describe("POST /api/admin/products", () => {
  it("blocks non-admin access", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
    });
    const req = new Request("http://localhost/api/admin/products", { method: "POST", body: buildCreateForm() });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects a missing title", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    const req = new Request("http://localhost", { method: "POST", body: buildCreateForm({ title: "   " }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("請輸入標題");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("rejects a missing price display text", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    const req = new Request("http://localhost", { method: "POST", body: buildCreateForm({ priceText: "" }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("請輸入價格顯示文字");
  });

  it("rejects an invalid youtubeUrl", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    const req = new Request("http://localhost", {
      method: "POST",
      body: buildCreateForm({ youtubeUrl: "not-a-youtube-url" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("無效的 YouTube 網址，請確認包含正確的影片 ID");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("accepts a blank youtubeUrl (optional field) and a valid one", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(createProduct).mockResolvedValueOnce(42);
    vi.mocked(saveProductPhotos).mockResolvedValueOnce(["a.webp"]);

    const req = new Request("http://localhost", {
      method: "POST",
      body: buildCreateForm({ youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" }),
    );
  });

  it("rejects malformed order JSON", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    const req = new Request("http://localhost", { method: "POST", body: buildCreateForm({ order: "{not json" }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("照片順序資料不正確");
  });

  it("rejects zero photos (order empty)", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    const req = new Request("http://localhost", {
      method: "POST",
      body: buildCreateForm({ order: "[]" }, []),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("至少需要上傳一張照片");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("creates the product, saves photos, resolves order and returns the new id", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(createProduct).mockResolvedValueOnce(42);
    vi.mocked(saveProductPhotos).mockResolvedValueOnce(["a.webp"]);

    const req = new Request("http://localhost", { method: "POST", body: buildCreateForm() });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, id: 42 });
    expect(createProduct).toHaveBeenCalledWith({
      title: "限量特惠鴿",
      priceText: "NT$12,000",
      description: "簡介內容",
      sortOrder: undefined,
      isActive: undefined,
      youtubeUrl: null,
    });
    expect(saveProductPhotos).toHaveBeenCalledWith(42, expect.any(Array));
    expect(replaceProductPhotos).toHaveBeenCalledWith(42, [{ fileName: "a.webp", isCover: true }]);
  });

  it("rolls back (deletes the product and any saved files) when order resolution fails", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(createProduct).mockResolvedValueOnce(42);
    // Saved only 1 file, but the order references index 1 (out of range).
    vi.mocked(saveProductPhotos).mockResolvedValueOnce(["a.webp"]);

    const req = new Request("http://localhost", {
      method: "POST",
      body: buildCreateForm({ order: JSON.stringify([{ type: "new", index: 1, isCover: true }]) }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("照片資料不正確");
    expect(deleteProductPhotoFiles).toHaveBeenCalledWith(42, ["a.webp"]);
    expect(deleteProduct).toHaveBeenCalledWith(42);
    expect(replaceProductPhotos).not.toHaveBeenCalled();
  });

  it("rolls back when saving photos throws", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(createProduct).mockResolvedValueOnce(42);
    vi.mocked(saveProductPhotos).mockRejectedValueOnce(new Error("圖片檔案過大"));

    const req = new Request("http://localhost", { method: "POST", body: buildCreateForm() });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("圖片檔案過大");
    expect(deleteProduct).toHaveBeenCalledWith(42);
  });
});
