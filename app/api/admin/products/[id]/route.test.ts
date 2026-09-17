import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { DELETE, GET, PATCH } from "./route";
import { requireAdmin } from "@/lib/apiAuth";
import { deleteProduct, getProductById, replaceProductPhotos, updateProduct } from "@/lib/products";
import { deleteProductPhotoFiles, saveProductPhotos } from "@/lib/uploads";

vi.mock("@/lib/apiAuth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/products", () => ({
  getProductById: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  replaceProductPhotos: vi.fn(),
}));

vi.mock("@/lib/uploads", () => ({
  saveProductPhotos: vi.fn(),
  deleteProductPhotoFiles: vi.fn(),
  productPhotoUrl: (productId: number, fileName: string) => `/uploads/products/${productId}/${fileName}`,
  // No test here submits a `descriptionImages` file, so this always resolves
  // to an empty array — resolveDescriptionImagePlaceholders/
  // sanitizeDescriptionHtml (both real, not mocked) then pass the raw
  // description through unchanged.
  saveDescriptionImages: vi.fn().mockResolvedValue([]),
  descriptionImageUrl: (entityType: string, entityId: number, fileName: string) =>
    `/uploads/${entityType}/${entityId}/description/${fileName}`,
}));

const adminAuth = { user: { id: 1, email: "admin@example.com", role: "admin" as const } };

const existingProduct = {
  id: 5,
  title: "限量特惠鴿",
  priceText: "12000",
  price: 12000,
  stockQuantity: 10,
  stockRemaining: 10,
  description: "簡介",
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  youtubeUrl: null,
  photos: [{ id: 1, fileName: "a.webp", sortOrder: 0, isCover: true }],
};

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function buildEditForm(overrides: Record<string, string> = {}, photos: File[] = []) {
  const form = new FormData();
  form.set("title", overrides.title ?? "限量特惠鴿");
  form.set("callForPrice", overrides.callForPrice ?? "false");
  form.set("price", overrides.price ?? "12000");
  form.set("stockRemaining", overrides.stockRemaining ?? "10");
  form.set("description", overrides.description ?? "簡介");
  form.set("sortOrder", overrides.sortOrder ?? "0");
  form.set("isActive", overrides.isActive ?? "true");
  if (overrides.youtubeUrl !== undefined) form.set("youtubeUrl", overrides.youtubeUrl);
  form.set(
    "order",
    overrides.order ?? JSON.stringify([{ type: "existing", fileName: "a.webp", isCover: true }]),
  );
  for (const photo of photos) form.append("photos", photo);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/products/[id]", () => {
  it("blocks non-admin access", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
    });
    const res = await GET(new Request("http://localhost"), params("5"));
    expect(res.status).toBe(401);
  });

  it("404s on a non-numeric id", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    const res = await GET(new Request("http://localhost"), params("abc"));
    expect(res.status).toBe(404);
  });

  it("404s when the product doesn't exist", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost"), params("999"));
    expect(res.status).toBe(404);
  });

  it("returns the product with photo URLs", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    const res = await GET(new Request("http://localhost"), params("5"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.product.photos[0].url).toBe("/uploads/products/5/a.webp");
  });
});

describe("PATCH /api/admin/products/[id]", () => {
  it("blocks non-admin access", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
    });
    const req = new Request("http://localhost", { method: "PATCH", body: buildEditForm() });
    const res = await PATCH(req, params("5"));
    expect(res.status).toBe(401);
  });

  it("404s when the product doesn't exist", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(null);
    const req = new Request("http://localhost", { method: "PATCH", body: buildEditForm() });
    const res = await PATCH(req, params("999"));
    expect(res.status).toBe(404);
  });

  it("rejects an invalid sortOrder", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    const req = new Request("http://localhost", { method: "PATCH", body: buildEditForm({ sortOrder: "-1" }) });
    const res = await PATCH(req, params("5"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("排序必須是不小於 0 的整數");
  });

  it("rejects an invalid price when not call-for-price", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    const req = new Request("http://localhost", { method: "PATCH", body: buildEditForm({ price: "0" }) });
    const res = await PATCH(req, params("5"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("價格必須是正數");
  });

  it("skips price/stock validation and writes null for both when callForPrice is true", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    vi.mocked(saveProductPhotos).mockResolvedValueOnce([]);
    vi.mocked(updateProduct).mockResolvedValueOnce({ ok: true });

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: buildEditForm({ callForPrice: "true", price: "", stockRemaining: "" }),
    });
    const res = await PATCH(req, params("5"));

    expect(res.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith(5, expect.objectContaining({ price: null, stockRemaining: null }));
  });

  it("rejects an invalid youtubeUrl", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    const req = new Request("http://localhost", { method: "PATCH", body: buildEditForm({ youtubeUrl: "not-a-url" }) });
    const res = await PATCH(req, params("5"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("無效的 YouTube 網址，請確認包含正確的影片 ID");
  });

  it("rejects dropping every photo (order resolves to empty)", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    const req = new Request("http://localhost", { method: "PATCH", body: buildEditForm({ order: "[]" }) });
    const res = await PATCH(req, params("5"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("至少需要一張照片");
  });

  it("updates the product, replaces photos and deletes removed files", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    vi.mocked(saveProductPhotos).mockResolvedValueOnce([]);
    vi.mocked(updateProduct).mockResolvedValueOnce({ ok: true });

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: buildEditForm({
        title: "新標題",
        order: JSON.stringify([{ type: "existing", fileName: "a.webp", isCover: true }]),
      }),
    });
    const res = await PATCH(req, params("5"));

    expect(res.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith(5, {
      title: "新標題",
      price: 12000,
      stockRemaining: 10,
      description: "簡介",
      sortOrder: 0,
      isActive: true,
      youtubeUrl: null,
    });
    expect(replaceProductPhotos).toHaveBeenCalledWith(5, [{ fileName: "a.webp", isCover: true }]);
    // a.webp is kept, so nothing should be deleted from disk.
    expect(deleteProductPhotoFiles).toHaveBeenCalledWith(5, []);
  });

  it("deletes photo files that were dropped from the new order", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce({
      ...existingProduct,
      photos: [
        { id: 1, fileName: "a.webp", sortOrder: 0, isCover: true },
        { id: 2, fileName: "b.webp", sortOrder: 1, isCover: false },
      ],
    });
    vi.mocked(saveProductPhotos).mockResolvedValueOnce([]);
    vi.mocked(updateProduct).mockResolvedValueOnce({ ok: true });

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: buildEditForm({ order: JSON.stringify([{ type: "existing", fileName: "a.webp", isCover: true }]) }),
    });
    const res = await PATCH(req, params("5"));

    expect(res.status).toBe(200);
    expect(deleteProductPhotoFiles).toHaveBeenCalledWith(5, ["b.webp"]);
  });

  it("rolls back newly-saved files when the update itself is rejected", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    vi.mocked(saveProductPhotos).mockResolvedValueOnce(["new.webp"]);
    vi.mocked(updateProduct).mockResolvedValueOnce({ ok: false, error: "找不到這個商品" });

    const req = new Request("http://localhost", {
      method: "PATCH",
      body: buildEditForm({
        order: JSON.stringify([
          { type: "existing", fileName: "a.webp", isCover: false },
          { type: "new", index: 0, isCover: true },
        ]),
      }),
    });
    const res = await PATCH(req, params("5"));

    expect(res.status).toBe(400);
    expect(deleteProductPhotoFiles).toHaveBeenCalledWith(5, ["new.webp"]);
    expect(replaceProductPhotos).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/products/[id]", () => {
  it("blocks non-admin access", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      response: NextResponse.json({ ok: false, error: "未授權" }, { status: 401 }),
    });
    const res = await DELETE(new Request("http://localhost"), params("5"));
    expect(res.status).toBe(401);
  });

  it("404s when the product doesn't exist", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(null);
    const res = await DELETE(new Request("http://localhost"), params("999"));
    expect(res.status).toBe(404);
  });

  it("deletes the product row and its photo files", async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(adminAuth);
    vi.mocked(getProductById).mockResolvedValueOnce(existingProduct);
    vi.mocked(deleteProduct).mockResolvedValueOnce({ ok: true });

    const res = await DELETE(new Request("http://localhost"), params("5"));

    expect(res.status).toBe(200);
    expect(deleteProduct).toHaveBeenCalledWith(5);
    expect(deleteProductPhotoFiles).toHaveBeenCalledWith(5, ["a.webp"]);
  });
});
