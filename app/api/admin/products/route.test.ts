// Mocks the auth guard, the DB-backed lib/products.ts and the filesystem-
// backed lib/uploads.ts (same split as app/api/admin/homepage-videos/
// route.test.ts), but NOT lib/productPhotoOrder.ts / lib/productValidation.ts
// — those are pure and exercised for real here, so these tests also cover
// real request parsing/validation, not just error propagation.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET, POST } from "./route";
import { requireAdmin } from "@/lib/apiAuth";
import { createProduct, deleteProduct, listProducts, replaceProductPhotos, updateProductDescription } from "@/lib/products";
import { deleteProductPhotoFiles, saveProductPhotos } from "@/lib/uploads";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/products", () => ({
  listProducts: vi.fn(),
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  replaceProductPhotos: vi.fn(),
  updateProductDescription: vi.fn(),
}));

vi.mock("@/lib/uploads", () => ({
  saveProductPhotos: vi.fn(),
  deleteProductPhotoFiles: vi.fn(),
  productPhotoUrl: (productId: number, fileName: string) => `/uploads/products/${productId}/${fileName}`,
  // No test here submits a `descriptionImages` file, so this always resolves
  // to an empty array — resolveDescriptionImagePlaceholders/
  // sanitizeDescriptionHtml (both real, not mocked) then pass the raw
  // description through unchanged, same as before issue #315's two-phase
  // create flow existed.
  saveDescriptionImages: vi.fn().mockResolvedValue([]),
  descriptionImageUrl: (entityType: string, entityId: number, fileName: string) =>
    `/uploads/${entityType}/${entityId}/description/${fileName}`,
}));

const adminAuth = { user: { id: 1, email: "admin@example.com", role: "admin" as const } };

function buildCreateForm(overrides: Record<string, string> = {}, photos: File[] = [new File(["x"], "a.webp")]) {
  const form = new FormData();
  form.set("title", overrides.title ?? "限量特惠鴿");
  form.set("callForPrice", overrides.callForPrice ?? "false");
  form.set("price", overrides.price ?? "12000");
  form.set("stockQuantity", overrides.stockQuantity ?? "5");
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
        priceText: "1",
        price: 1,
        stockQuantity: 5,
        stockRemaining: 5,
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

  it("rejects an invalid price when not call-for-price", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    const req = new Request("http://localhost", { method: "POST", body: buildCreateForm({ price: "0" }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("價格必須是正數");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("rejects a missing stock quantity when not call-for-price", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    const req = new Request("http://localhost", { method: "POST", body: buildCreateForm({ stockQuantity: "" }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("庫存數量必須是正整數");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("skips price/stock validation entirely when callForPrice is true", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(createProduct).mockResolvedValueOnce(42);
    vi.mocked(saveProductPhotos).mockResolvedValueOnce(["a.webp"]);

    const req = new Request("http://localhost", {
      method: "POST",
      body: buildCreateForm({ callForPrice: "true", price: "", stockQuantity: "" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ price: null, stockQuantity: null }));
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
    // description is inserted empty and backfilled afterward (issue #315's
    // two-phase create — see the route's own comment) so the product's own
    // id exists before saveDescriptionImages needs it.
    expect(createProduct).toHaveBeenCalledWith({
      title: "限量特惠鴿",
      price: 12000,
      stockQuantity: 5,
      description: "",
      sortOrder: undefined,
      isActive: undefined,
      youtubeUrl: null,
    });
    expect(saveProductPhotos).toHaveBeenCalledWith(42, expect.any(Array));
    expect(replaceProductPhotos).toHaveBeenCalledWith(42, [{ fileName: "a.webp", isCover: true }]);
    expect(updateProductDescription).toHaveBeenCalledWith(42, "簡介內容");
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
