// lib/featuredLoftPosts.ts is raw-SQL CRUD (no ORM, see its own header
// comment), so like lib/news.test.ts / lib/pigeonShowcase.test.ts this mocks
// @/lib/db's getDb() and asserts on the SQL/params each function sends plus
// how it maps mysql2's raw rows/results back into the module's public
// shapes. The create/update loftId-validation tests mirror
// lib/pigeonShowcase.test.ts's isPartnerLoft coverage exactly, plus the
// null-loftId case that module doesn't have (pigeon_showcase.loft_id is
// required; featured_loft_posts.loft_id is optional).

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFeaturedLoftPost,
  deleteFeaturedLoftPost,
  getFeaturedLoftPostById,
  listFeaturedLoftPosts,
  listLatestFeaturedLoftPosts,
  updateFeaturedLoftPost,
} from "./featuredLoftPosts";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

const ROW = {
  id: 1,
  title: "石君鴿舍專訪",
  content: "<p>深入石君鴿舍的育種理念</p>",
  image_file_name: "loft123.jpg",
  loft_id: 5,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
};

describe("listFeaturedLoftPosts", () => {
  it("filters by title search, mapping snake_case rows to the public shape", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]); // count
    queryMock.mockResolvedValueOnce([[ROW]]); // page

    const { items, total } = await listFeaturedLoftPosts({ search: "石君" });

    expect(total).toBe(1);
    expect(queryMock.mock.calls[0][0]).toContain("WHERE title LIKE ?");
    expect(queryMock.mock.calls[0][1]).toEqual(["%石君%"]);
    expect(queryMock.mock.calls[1][1]).toEqual(["%石君%"]);
    expect(items).toEqual([
      {
        id: 1,
        title: "石君鴿舍專訪",
        content: "<p>深入石君鴿舍的育種理念</p>",
        imageFileName: "loft123.jpg",
        loftId: 5,
        createdAt: ROW.created_at,
        updatedAt: ROW.updated_at,
      },
    ]);
  });

  it("maps a null loft_id to loftId: null", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    queryMock.mockResolvedValueOnce([[{ ...ROW, loft_id: null }]]);

    const { items } = await listFeaturedLoftPosts();

    expect(items[0].loftId).toBeNull();
  });

  it("orders newest-first and paginates using the requested page size", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listFeaturedLoftPosts({ page: 2, pageSize: 50 });

    expect(queryMock.mock.calls[1][0]).toContain("ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET 50");
  });

  it("omits filter conditions entirely with no options", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listFeaturedLoftPosts();

    expect(queryMock.mock.calls[0][0]).not.toContain("WHERE");
    expect(queryMock.mock.calls[0][1]).toEqual([]);
  });

  it("defaults to page 1 / DEFAULT page size when unspecified", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listFeaturedLoftPosts();

    expect(queryMock.mock.calls[1][0]).toContain("LIMIT 30 OFFSET 0");
  });
});

describe("listLatestFeaturedLoftPosts", () => {
  it("queries with a LIMIT param, newest-first", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    const items = await listLatestFeaturedLoftPosts(10);

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY created_at DESC, id DESC LIMIT ?"), [10]);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("石君鴿舍專訪");
  });
});

describe("getFeaturedLoftPostById", () => {
  it("returns null when no row matches", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await getFeaturedLoftPostById(999)).toBeNull();
  });

  it("returns the mapped row when found", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);
    const item = await getFeaturedLoftPostById(1);
    expect(item?.title).toBe("石君鴿舍專訪");
  });
});

describe("createFeaturedLoftPost", () => {
  it("rejects when loftId isn't a partner_loft-typed homepage_sections row", async () => {
    queryMock.mockResolvedValueOnce([[]]); // isPartnerLoft check finds nothing

    const result = await createFeaturedLoftPost({ title: "t", content: "c", imageFileName: "img.jpg", loftId: 99 });

    expect(result).toEqual({ ok: false, error: "找不到這個合作鴿舍" });
    expect(queryMock).toHaveBeenCalledTimes(1); // no INSERT fired
  });

  it("inserts and returns the new id when loftId is valid", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]); // isPartnerLoft check succeeds
    queryMock.mockResolvedValueOnce([{ insertId: 42 }]);

    const result = await createFeaturedLoftPost({ title: "t", content: "c", imageFileName: "img.jpg", loftId: 5 });

    expect(result).toEqual({ ok: true, id: 42 });
    expect(queryMock.mock.calls[1][1]).toEqual(["t", "img.jpg", "c", 5]);
  });

  it("skips the isPartnerLoft check entirely and inserts when loftId is null", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 7 }]);

    const result = await createFeaturedLoftPost({ title: "t", content: "c", imageFileName: "img.jpg", loftId: null });

    expect(result).toEqual({ ok: true, id: 7 });
    expect(queryMock).toHaveBeenCalledTimes(1); // no isPartnerLoft SELECT fired
    expect(queryMock.mock.calls[0][1]).toEqual(["t", "img.jpg", "c", null]);
  });
});

describe("updateFeaturedLoftPost", () => {
  it("rejects when loftId isn't a partner_loft-typed homepage_sections row", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    const result = await updateFeaturedLoftPost(1, { title: "t", content: "c", imageFileName: "img.jpg", loftId: 99 });
    expect(result).toEqual({ ok: false, error: "找不到這個合作鴿舍" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("skips the isPartnerLoft check and updates when loftId is null (clearing an existing link)", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await updateFeaturedLoftPost(1, { title: "t", content: "c", imageFileName: "img.jpg", loftId: null });

    expect(result).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][1]).toEqual(["t", "img.jpg", "c", null, 1]);
  });

  it("returns ok:false when no row matched (deleted or bad id)", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await updateFeaturedLoftPost(1, { title: "t", content: "c", imageFileName: "img.jpg", loftId: 5 });
    expect(result).toEqual({ ok: false, error: "找不到這篇名家專區文章" });
  });

  it("returns ok:true when a row is updated", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await updateFeaturedLoftPost(1, { title: "t", content: "c", imageFileName: "img.jpg", loftId: 5 });
    expect(result).toEqual({ ok: true });
  });
});

describe("deleteFeaturedLoftPost", () => {
  it("returns ok:false when no row matched", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect(await deleteFeaturedLoftPost(1)).toEqual({ ok: false, error: "找不到這篇名家專區文章" });
  });

  it("returns ok:true when a row is deleted", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect(await deleteFeaturedLoftPost(1)).toEqual({ ok: true });
  });
});
