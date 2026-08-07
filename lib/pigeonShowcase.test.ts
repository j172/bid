// lib/pigeonShowcase.ts is raw-SQL CRUD (no ORM, see its own header
// comment), so like lib/homepageSections.test.ts these mock @/lib/db's
// getDb() and assert on the SQL/params each function sends plus how it maps
// mysql2's raw rows/results back into the module's public shapes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPigeonShowcase,
  deletePigeonShowcase,
  getPigeonShowcaseById,
  listLatestPigeonShowcase,
  listPigeonShowcase,
  updatePigeonShowcase,
} from "./pigeonShowcase";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

const ROW = {
  id: 1,
  category: "award",
  name: "石君01",
  loft_id: 5,
  loft_title: "石君鴿舍",
  description: "<p>血統優良</p>",
  image_file_name: "abc123.jpg",
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
};

describe("listPigeonShowcase", () => {
  it("filters by category, search, and loftId together, mapping snake_case rows to the public shape", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]); // count
    queryMock.mockResolvedValueOnce([[ROW]]); // page

    const { items, total } = await listPigeonShowcase({ category: "award", search: "石君", loftId: 5 });

    expect(total).toBe(1);
    expect(queryMock.mock.calls[0][0]).toContain("WHERE ps.category = ? AND ps.name LIKE ? AND ps.loft_id = ?");
    expect(queryMock.mock.calls[0][1]).toEqual(["award", "%石君%", 5]);
    expect(queryMock.mock.calls[1][1]).toEqual(["award", "%石君%", 5]);
    expect(items).toEqual([
      {
        id: 1,
        category: "award",
        name: "石君01",
        loftId: 5,
        loftTitle: "石君鴿舍",
        description: "<p>血統優良</p>",
        imageFileName: "abc123.jpg",
        createdAt: ROW.created_at,
        updatedAt: ROW.updated_at,
      },
    ]);
  });

  it("orders newest-first and paginates using the requested page size", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listPigeonShowcase({ page: 2, pageSize: 50 });

    expect(queryMock.mock.calls[1][0]).toContain("ORDER BY ps.created_at DESC, ps.id DESC LIMIT 50 OFFSET 50");
  });

  it("omits filter conditions entirely with no options (admin default view)", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listPigeonShowcase();

    expect(queryMock.mock.calls[0][0]).not.toContain("WHERE");
    expect(queryMock.mock.calls[0][1]).toEqual([]);
  });

  it("defaults to page 1 / DEFAULT page size when unspecified", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listPigeonShowcase();

    expect(queryMock.mock.calls[1][0]).toContain("LIMIT 30 OFFSET 0");
  });
});

describe("listLatestPigeonShowcase", () => {
  it("queries by category with a LIMIT param, newest-first", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    const items = await listLatestPigeonShowcase("award", 10);

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY ps.created_at DESC, ps.id DESC LIMIT ?"), [
      "award",
      10,
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].loftTitle).toBe("石君鴿舍");
  });
});

describe("getPigeonShowcaseById", () => {
  it("returns null when no row matches", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await getPigeonShowcaseById(999)).toBeNull();
  });

  it("returns the mapped row (joined with loft title) when found", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);
    const item = await getPigeonShowcaseById(1);
    expect(item?.loftTitle).toBe("石君鴿舍");
    expect(item?.category).toBe("award");
  });
});

describe("createPigeonShowcase", () => {
  it("rejects when loftId isn't a partner_loft-typed homepage_sections row", async () => {
    queryMock.mockResolvedValueOnce([[]]); // isPartnerLoft check finds nothing

    const result = await createPigeonShowcase({ category: "award", name: "n", loftId: 99, description: "d", imageFileName: "img.jpg" });

    expect(result).toEqual({ ok: false, error: "找不到這個合作鴿舍" });
    expect(queryMock).toHaveBeenCalledTimes(1); // no INSERT fired
  });

  it("inserts and returns the new id when loftId is valid", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]); // isPartnerLoft check succeeds
    queryMock.mockResolvedValueOnce([{ insertId: 42 }]);

    const result = await createPigeonShowcase({ category: "imported", name: "n", loftId: 5, description: "d", imageFileName: "img.jpg" });

    expect(result).toEqual({ ok: true, id: 42 });
    expect(queryMock.mock.calls[1][1]).toEqual(["imported", "n", 5, "img.jpg", "d"]);
  });
});

describe("updatePigeonShowcase", () => {
  it("rejects when loftId isn't a partner_loft-typed homepage_sections row", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    const result = await updatePigeonShowcase(1, { category: "award", name: "n", loftId: 99, description: "d", imageFileName: "img.jpg" });
    expect(result).toEqual({ ok: false, error: "找不到這個合作鴿舍" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("returns ok:false when no row matched (deleted or bad id)", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await updatePigeonShowcase(1, { category: "award", name: "n", loftId: 5, description: "d", imageFileName: "img.jpg" });
    expect(result).toEqual({ ok: false, error: "找不到這筆鴿況資料" });
  });

  it("returns ok:true when a row is updated", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await updatePigeonShowcase(1, { category: "award", name: "n", loftId: 5, description: "d", imageFileName: "img.jpg" });
    expect(result).toEqual({ ok: true });
  });
});

describe("deletePigeonShowcase", () => {
  it("returns ok:false when no row matched", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect(await deletePigeonShowcase(1)).toEqual({ ok: false, error: "找不到這筆鴿況資料" });
  });

  it("returns ok:true when a row is deleted", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect(await deletePigeonShowcase(1)).toEqual({ ok: true });
  });
});
