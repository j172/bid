// lib/products.ts is raw-SQL CRUD (no ORM, see its own header comment)
// rather than pure logic, so like lib/homepageSections.test.ts these mock
// @/lib/db's getDb() and assert on the SQL/params each function sends plus
// how it maps mysql2's raw rows/results back into the module's public
// shapes — covering CRUD + the photo-gallery/cover-photo behaviour per issue
// #277's acceptance criteria. queryMock is created via vi.hoisted so it
// exists before vi.mock's factory below runs.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductPhotos,
  listProducts,
  replaceProductPhotos,
  updateProduct,
} from "./products";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe("listProducts", () => {
  it("lists products ordered by sort_order and attaches each product's photos", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const updatedAt = new Date("2026-01-02T00:00:00Z");
    queryMock.mockResolvedValueOnce([
      [
        {
          id: 1,
          title: "限量特惠鴿",
          price_text: "NT$12,000",
          description: "簡介",
          sort_order: 0,
          is_active: 1,
          created_at: createdAt,
          updated_at: updatedAt,
        },
      ],
    ]);
    queryMock.mockResolvedValueOnce([
      [
        { id: 10, product_id: 1, file_name: "cover.webp", sort_order: 0, is_cover: 1, created_at: createdAt },
        { id: 11, product_id: 1, file_name: "other.webp", sort_order: 1, is_cover: 0, created_at: createdAt },
      ],
    ]);

    const products = await listProducts();

    expect(queryMock.mock.calls[0][0]).toContain("ORDER BY sort_order ASC, id ASC");
    expect(queryMock.mock.calls[0][0]).not.toContain("WHERE");
    expect(products).toEqual([
      {
        id: 1,
        title: "限量特惠鴿",
        priceText: "NT$12,000",
        description: "簡介",
        sortOrder: 0,
        isActive: true,
        createdAt,
        updatedAt,
        photos: [
          { id: 10, fileName: "cover.webp", sortOrder: 0, isCover: true },
          { id: 11, fileName: "other.webp", sortOrder: 1, isCover: false },
        ],
      },
    ]);
  });

  it("adds an is_active = 1 condition when activeOnly is requested (homepage carousel view)", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    await listProducts({ activeOnly: true });
    expect(queryMock.mock.calls[0][0]).toContain("WHERE is_active = 1");
  });

  it("omits the is_active condition by default (admin view sees inactive/下架 rows too)", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    await listProducts();
    expect(queryMock.mock.calls[0][0]).not.toContain("is_active");
  });
});

describe("getProductById", () => {
  it("returns null when no row matches", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await getProductById(999)).toBeNull();
  });

  it("returns the product with its photos when found", async () => {
    const createdAt = new Date();
    queryMock.mockResolvedValueOnce([
      [
        {
          id: 5,
          title: "t",
          price_text: "電洽",
          description: "d",
          sort_order: 2,
          is_active: 0,
          created_at: createdAt,
          updated_at: createdAt,
        },
      ],
    ]);
    queryMock.mockResolvedValueOnce([[]]);

    const product = await getProductById(5);
    expect(product?.isActive).toBe(false);
    expect(product?.photos).toEqual([]);
  });

  it("adds an is_active = 1 condition when activeOnly is requested (public detail page)", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    await getProductById(1, { activeOnly: true });
    expect(queryMock.mock.calls[0][0]).toContain("is_active = 1");
    expect(queryMock.mock.calls[0][1]).toEqual([1]);
  });
});

describe("getProductPhotos", () => {
  it("orders by sort_order ASC, id ASC", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    await getProductPhotos(7);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE product_id = ? ORDER BY sort_order ASC, id ASC"),
      [7],
    );
  });
});

describe("createProduct", () => {
  it("uses an explicit sortOrder without a lookup query", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 42 }]);

    const id = await createProduct({ title: "t", priceText: "NT$1", description: "d", sortOrder: 3 });

    expect(id).toBe(42);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][1]).toEqual(["t", "NT$1", "d", 3, 1]);
  });

  it("defaults sortOrder to MAX(sort_order) + 1 when omitted", async () => {
    queryMock.mockResolvedValueOnce([[{ nextOrder: 7 }]]);
    queryMock.mockResolvedValueOnce([{ insertId: 8 }]);

    const id = await createProduct({ title: "t", priceText: "NT$1", description: "d" });

    expect(id).toBe(8);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[1][1]).toEqual(["t", "NT$1", "d", 7, 1]);
  });

  it("stores isActive: false as 0", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 1 }]);
    await createProduct({ title: "t", priceText: "NT$1", description: "d", sortOrder: 0, isActive: false });
    expect(queryMock.mock.calls[0][1][4]).toBe(0);
  });

  it("defaults isActive to 1 when omitted", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 1 }]);
    await createProduct({ title: "t", priceText: "NT$1", description: "d", sortOrder: 0 });
    expect(queryMock.mock.calls[0][1][4]).toBe(1);
  });
});

describe("updateProduct", () => {
  it("returns ok:false when no row matched (deleted or bad id)", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await updateProduct(1, { title: "t", priceText: "NT$1", description: "d", sortOrder: 0, isActive: true });
    expect(result).toEqual({ ok: false, error: "找不到這個商品" });
  });

  it("returns ok:true when a row is updated", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await updateProduct(1, { title: "t", priceText: "NT$1", description: "d", sortOrder: 0, isActive: true });
    expect(result).toEqual({ ok: true });
  });
});

describe("deleteProduct", () => {
  it("returns ok:false when no row matched, without deleting photos", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await deleteProduct(1);
    expect(result).toEqual({ ok: false, error: "找不到這個商品" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("deletes the product row then its product_photos rows", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 2 }]);
    const result = await deleteProduct(1);
    expect(result).toEqual({ ok: true });
    expect(queryMock.mock.calls[0][0]).toContain("DELETE FROM products");
    expect(queryMock.mock.calls[1][0]).toContain("DELETE FROM product_photos");
  });
});

describe("replaceProductPhotos", () => {
  it("deletes the existing set then re-inserts in order with sort_order = array index", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 2 }]); // DELETE
    queryMock.mockResolvedValueOnce([{ insertId: 1 }]);
    queryMock.mockResolvedValueOnce([{ insertId: 2 }]);

    await replaceProductPhotos(9, [
      { fileName: "a.webp", isCover: true },
      { fileName: "b.webp", isCover: false },
    ]);

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock.mock.calls[0][0]).toContain("DELETE FROM product_photos WHERE product_id = ?");
    expect(queryMock.mock.calls[0][1]).toEqual([9]);
    expect(queryMock.mock.calls[1][1]).toEqual([9, "a.webp", 0, 1]);
    expect(queryMock.mock.calls[2][1]).toEqual([9, "b.webp", 1, 0]);
  });

  it("handles an empty photo list (delete only, no inserts)", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    await replaceProductPhotos(9, []);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
