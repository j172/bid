// lib/pigeonGallery.ts is raw-SQL CRUD (no ORM, see its own header comment)
// rather than pure logic like lib/listingValidation.ts, so unlike that
// file's tests, these mock @/lib/db's getDb() and assert on the SQL/params
// each function sends plus how it maps mysql2's raw rows/results back into
// the module's public shapes — covering CRUD and reorder for both
// categories and items per issue #33's acceptance criteria.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPigeonGalleryCategory,
  createPigeonGalleryItem,
  deletePigeonGalleryCategory,
  deletePigeonGalleryItem,
  getPigeonGalleryCategoryById,
  getPigeonGalleryItemById,
  listPigeonGalleryCategories,
  listPigeonGalleryItems,
  reorderPigeonGalleryCategories,
  reorderPigeonGalleryItems,
  updatePigeonGalleryCategory,
  updatePigeonGalleryItem,
} from "./pigeonGallery";

// See the equivalent comment in lib/homepageSections.test.ts on why
// queryMock is created via vi.hoisted.
const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe("pigeon gallery categories", () => {
  describe("listPigeonGalleryCategories", () => {
    it("filters by gallery_type and orders by sort_order, mapping snake_case rows", async () => {
      const createdAt = new Date("2026-01-01T00:00:00Z");
      const updatedAt = new Date("2026-01-02T00:00:00Z");
      queryMock.mockResolvedValueOnce([
        [
          {
            id: 1,
            gallery_type: "award",
            name: "石君鴿舍",
            cover_image_file_name: "c.webp",
            sort_order: 0,
            is_active: 1,
            created_at: createdAt,
            updated_at: updatedAt,
          },
        ],
      ]);

      const categories = await listPigeonGalleryCategories("award");

      expect(queryMock).toHaveBeenCalledWith(
        expect.stringContaining("WHERE gallery_type = ? ORDER BY sort_order ASC, id ASC"),
        ["award"],
      );
      expect(categories).toEqual([
        {
          id: 1,
          galleryType: "award",
          name: "石君鴿舍",
          coverImageFileName: "c.webp",
          sortOrder: 0,
          isActive: true,
          createdAt,
          updatedAt,
        },
      ]);
    });

    it("adds an is_active = 1 condition when activeOnly is requested", async () => {
      queryMock.mockResolvedValueOnce([[]]);
      await listPigeonGalleryCategories("import", { activeOnly: true });
      expect(queryMock.mock.calls[0][0]).toContain("is_active = 1");
    });
  });

  describe("getPigeonGalleryCategoryById", () => {
    it("returns null when no row matches", async () => {
      queryMock.mockResolvedValueOnce([[]]);
      expect(await getPigeonGalleryCategoryById(999)).toBeNull();
    });
  });

  describe("createPigeonGalleryCategory", () => {
    it("defaults sortOrder to MAX(sort_order) + 1 within the gallery_type when omitted", async () => {
      queryMock.mockResolvedValueOnce([[{ nextOrder: 4 }]]);
      queryMock.mockResolvedValueOnce([{ insertId: 9 }]);

      const id = await createPigeonGalleryCategory({ galleryType: "import", name: "比利時", coverImageFileName: "c.webp" });

      expect(id).toBe(9);
      expect(queryMock).toHaveBeenCalledTimes(2);
      expect(queryMock.mock.calls[0][1]).toEqual(["import"]);
      expect(queryMock.mock.calls[1][1]).toEqual(["import", "比利時", "c.webp", 4, 1]);
    });

    it("uses an explicit sortOrder without a lookup query", async () => {
      queryMock.mockResolvedValueOnce([{ insertId: 1 }]);
      await createPigeonGalleryCategory({ galleryType: "award", name: "翔水", coverImageFileName: "c.webp", sortOrder: 2 });
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock.mock.calls[0][1]).toEqual(["award", "翔水", "c.webp", 2, 1]);
    });
  });

  describe("updatePigeonGalleryCategory", () => {
    it("returns ok:false when no row matched", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
      const result = await updatePigeonGalleryCategory(1, { name: "n", coverImageFileName: "c", sortOrder: 0, isActive: true });
      expect(result).toEqual({ ok: false, error: "找不到這個鴿舍分類" });
    });

    it("returns ok:true when a row is updated", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const result = await updatePigeonGalleryCategory(1, { name: "n", coverImageFileName: "c", sortOrder: 0, isActive: true });
      expect(result).toEqual({ ok: true });
    });
  });

  describe("deletePigeonGalleryCategory", () => {
    it("deletes the category's items before deleting the category row itself", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 3 }]); // DELETE items
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE category

      const result = await deletePigeonGalleryCategory(1);

      expect(result).toEqual({ ok: true });
      expect(queryMock).toHaveBeenNthCalledWith(1, "DELETE FROM pigeon_gallery_items WHERE category_id = ?", [1]);
      expect(queryMock).toHaveBeenNthCalledWith(2, "DELETE FROM pigeon_gallery_categories WHERE id = ?", [1]);
    });

    it("still attempts the items cleanup even when the category itself doesn't exist, and reports not-found", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
      queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
      const result = await deletePigeonGalleryCategory(999);
      expect(result).toEqual({ ok: false, error: "找不到這個鴿舍分類" });
    });
  });

  describe("reorderPigeonGalleryCategories", () => {
    it("returns ok:true immediately for an empty list without querying", async () => {
      const result = await reorderPigeonGalleryCategories("award", []);
      expect(result).toEqual({ ok: true });
      expect(queryMock).not.toHaveBeenCalled();
    });

    it("rejects the whole call when an id doesn't belong to the given gallery_type", async () => {
      queryMock.mockResolvedValueOnce([[{ id: 2 }]]); // only 1 of 2 requested ids found
      const result = await reorderPigeonGalleryCategories("award", [2, 999]);
      expect(result).toEqual({ ok: false, error: "排序資料不正確" });
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("re-sequences sort_order to match each id's index in the given order", async () => {
      queryMock.mockResolvedValueOnce([[{ id: 2 }, { id: 5 }]]);
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await reorderPigeonGalleryCategories("award", [2, 5]);

      expect(result).toEqual({ ok: true });
      expect(queryMock.mock.calls[1][1]).toEqual([0, 2]);
      expect(queryMock.mock.calls[2][1]).toEqual([1, 5]);
    });
  });
});

describe("pigeon gallery items", () => {
  describe("listPigeonGalleryItems", () => {
    it("filters by category_id, joins the loft's title, and orders by sort_order, mapping snake_case rows", async () => {
      const createdAt = new Date("2026-01-01T00:00:00Z");
      const updatedAt = new Date("2026-01-02T00:00:00Z");
      queryMock.mockResolvedValueOnce([
        [
          {
            id: 1,
            category_id: 7,
            title: "冠軍鴿",
            image_file_name: "i.webp",
            loft_id: 3,
            loftName: "石君鴿舍",
            sort_order: 0,
            is_active: 1,
            created_at: createdAt,
            updated_at: updatedAt,
          },
        ],
      ]);

      const items = await listPigeonGalleryItems(7);

      expect(queryMock.mock.calls[0][1]).toEqual([7]);
      expect(queryMock.mock.calls[0][0]).toContain("WHERE i.category_id = ?");
      expect(queryMock.mock.calls[0][0]).toContain("ORDER BY i.sort_order ASC, i.id ASC");
      expect(queryMock.mock.calls[0][0]).toContain("LEFT JOIN homepage_sections loft ON loft.id = i.loft_id");
      expect(items).toEqual([
        {
          id: 1,
          categoryId: 7,
          title: "冠軍鴿",
          imageFileName: "i.webp",
          loftId: 3,
          loftName: "石君鴿舍",
          sortOrder: 0,
          isActive: true,
          createdAt,
          updatedAt,
        },
      ]);
    });

    it("adds an is_active = 1 condition when activeOnly is requested", async () => {
      queryMock.mockResolvedValueOnce([[]]);
      await listPigeonGalleryItems(7, { activeOnly: true });
      expect(queryMock.mock.calls[0][0]).toContain("i.is_active = 1");
    });
  });

  describe("getPigeonGalleryItemById", () => {
    it("returns null when no row matches", async () => {
      queryMock.mockResolvedValueOnce([[]]);
      expect(await getPigeonGalleryItemById(999)).toBeNull();
    });

    it("maps loftName to null when the plain lookup didn't join it in", async () => {
      queryMock.mockResolvedValueOnce([
        [
          {
            id: 1,
            category_id: 7,
            title: "t",
            image_file_name: "i.webp",
            loft_id: null,
            sort_order: 0,
            is_active: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      ]);
      const item = await getPigeonGalleryItemById(1);
      expect(item?.loftName).toBeNull();
    });
  });

  describe("createPigeonGalleryItem", () => {
    it("uses an explicit sortOrder and stores isActive: false as 0", async () => {
      queryMock.mockResolvedValueOnce([{ insertId: 11 }]);

      const id = await createPigeonGalleryItem({
        categoryId: 7,
        title: "t",
        imageFileName: "i.webp",
        loftId: 3,
        sortOrder: 2,
        isActive: false,
      });

      expect(id).toBe(11);
      expect(queryMock).toHaveBeenCalledTimes(1);
      expect(queryMock.mock.calls[0][1]).toEqual([7, "t", "i.webp", 3, 2, 0]);
    });

    it("defaults sortOrder to MAX(sort_order) + 1 within the category when omitted, and loftId to null", async () => {
      queryMock.mockResolvedValueOnce([[{ nextOrder: 3 }]]);
      queryMock.mockResolvedValueOnce([{ insertId: 12 }]);

      const id = await createPigeonGalleryItem({ categoryId: 7, title: "t", imageFileName: "i.webp" });

      expect(id).toBe(12);
      expect(queryMock.mock.calls[1][1]).toEqual([7, "t", "i.webp", null, 3, 1]);
    });
  });

  describe("updatePigeonGalleryItem", () => {
    it("returns ok:true when a row is updated", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const result = await updatePigeonGalleryItem(1, {
        title: "t",
        imageFileName: "i",
        loftId: 3,
        sortOrder: 0,
        isActive: true,
      });
      expect(result).toEqual({ ok: true });
    });

    it("returns ok:false when no row matched", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
      const result = await updatePigeonGalleryItem(1, {
        title: "t",
        imageFileName: "i",
        loftId: 3,
        sortOrder: 0,
        isActive: true,
      });
      expect(result).toEqual({ ok: false, error: "找不到這個展示鴿項目" });
    });

    it("clears loft_id to null when loftId is omitted", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
      await updatePigeonGalleryItem(1, { title: "t", imageFileName: "i", sortOrder: 0, isActive: true });
      expect(queryMock.mock.calls[0][1]).toEqual(["t", "i", null, 0, 1, 1]);
    });
  });

  describe("deletePigeonGalleryItem", () => {
    it("returns ok:false when no row matched", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
      expect(await deletePigeonGalleryItem(1)).toEqual({ ok: false, error: "找不到這個展示鴿項目" });
    });

    it("returns ok:true when a row is deleted", async () => {
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
      expect(await deletePigeonGalleryItem(1)).toEqual({ ok: true });
    });
  });

  describe("reorderPigeonGalleryItems", () => {
    it("returns ok:true immediately for an empty list without querying", async () => {
      const result = await reorderPigeonGalleryItems(7, []);
      expect(result).toEqual({ ok: true });
      expect(queryMock).not.toHaveBeenCalled();
    });

    it("rejects the whole call when an id doesn't belong to the given category_id", async () => {
      queryMock.mockResolvedValueOnce([[{ id: 4 }]]); // only 1 of 2 requested ids found
      const result = await reorderPigeonGalleryItems(7, [4, 999]);
      expect(result).toEqual({ ok: false, error: "排序資料不正確" });
      expect(queryMock).toHaveBeenCalledTimes(1);
    });

    it("re-sequences sort_order to match each id's index in the given order", async () => {
      queryMock.mockResolvedValueOnce([[{ id: 4 }, { id: 6 }]]);
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
      queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

      const result = await reorderPigeonGalleryItems(7, [6, 4]);

      expect(result).toEqual({ ok: true });
      expect(queryMock.mock.calls[1][1]).toEqual([0, 6]);
      expect(queryMock.mock.calls[2][1]).toEqual([1, 4]);
    });
  });
});
