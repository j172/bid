// lib/news.ts is raw-SQL CRUD (no ORM, see its own header comment), so like
// lib/pigeonShowcase.test.ts this mocks @/lib/db's getDb() and asserts on
// the SQL/params each function sends plus how it maps mysql2's raw
// rows/results back into the module's public shapes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createImportedNews,
  createNews,
  deleteNews,
  getNewsById,
  listHomepageNewsCarousel,
  listLatestNews,
  listNews,
  setNewsBroadcastId,
  updateNews,
} from "./news";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

const ROW = {
  id: 1,
  title: "本週競標時間異動",
  content: "<p>本週競標時間調整為晚上八點</p>",
  image_file_name: "news123.jpg",
  broadcast_id: "bcast_1",
  source: "manual" as const,
  source_url: null,
  original_title: null,
  original_content: null,
  published_at: null,
  locked_by_admin: 0,
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
};

describe("listNews", () => {
  it("filters by title search, mapping snake_case rows to the public shape", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]); // count
    queryMock.mockResolvedValueOnce([[ROW]]); // page

    const { items, total } = await listNews({ search: "競標" });

    expect(total).toBe(1);
    expect(queryMock.mock.calls[0][0]).toContain("WHERE title LIKE ?");
    expect(queryMock.mock.calls[0][1]).toEqual(["%競標%"]);
    expect(queryMock.mock.calls[1][1]).toEqual(["%競標%"]);
    expect(items).toEqual([
      {
        id: 1,
        title: "本週競標時間異動",
        content: "<p>本週競標時間調整為晚上八點</p>",
        imageFileName: "news123.jpg",
        broadcastId: "bcast_1",
        source: "manual",
        sourceUrl: null,
        originalTitle: null,
        originalContent: null,
        publishedAt: null,
        lockedByAdmin: false,
        createdAt: ROW.created_at,
        updatedAt: ROW.updated_at,
      },
    ]);
  });

  it("orders newest-first (by original publish date, falling back to import date) and paginates using the requested page size", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listNews({ page: 2, pageSize: 50 });

    expect(queryMock.mock.calls[1][0]).toContain(
      "ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT 50 OFFSET 50",
    );
  });

  it("omits filter conditions entirely with no options", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listNews();

    expect(queryMock.mock.calls[0][0]).not.toContain("WHERE");
    expect(queryMock.mock.calls[0][1]).toEqual([]);
  });

  it("defaults to page 1 / DEFAULT page size when unspecified", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listNews();

    expect(queryMock.mock.calls[1][0]).toContain("LIMIT 30 OFFSET 0");
  });
});

describe("listLatestNews", () => {
  it("queries with a LIMIT param, newest-first", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    const items = await listLatestNews(10);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ?"),
      [10],
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("本週競標時間異動");
  });
});

describe("getNewsById", () => {
  it("returns null when no row matches", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await getNewsById(999)).toBeNull();
  });

  it("returns the mapped row when found", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);
    const item = await getNewsById(1);
    expect(item?.title).toBe("本週競標時間異動");
  });
});

describe("createNews", () => {
  it("inserts and returns the new id", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 42 }]);

    const result = await createNews({ title: "t", content: "c", imageFileName: "img.jpg" });

    expect(result).toEqual({ ok: true, id: 42 });
    expect(queryMock.mock.calls[0][1]).toEqual(["t", "img.jpg", "c"]);
  });
});

describe("updateNews", () => {
  it("returns ok:false when no row matched (deleted or bad id)", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await updateNews(1, { title: "t", content: "c", imageFileName: "img.jpg" });
    expect(result).toEqual({ ok: false, error: "找不到這則訊息" });
  });

  it("returns ok:true when a row is updated", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await updateNews(1, { title: "t", content: "c", imageFileName: "img.jpg" });
    expect(result).toEqual({ ok: true });
  });

  // issue #240: every admin edit locks the row so lib/newsSync.ts never
  // overwrites it again — this is the only place that flag gets set, so it
  // has to happen on every call here, not just herbots-imported rows.
  it("always sets locked_by_admin = 1, regardless of the row's source", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await updateNews(1, { title: "t", content: "c", imageFileName: "img.jpg" });
    expect(queryMock.mock.calls[0][0]).toContain("locked_by_admin = 1");
  });
});

describe("createImportedNews", () => {
  it("inserts a herbots-sourced row with the original-language + publish-date columns", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 7 }]);

    const publishedAt = new Date("2026-09-01T12:00:00Z");
    const result = await createImportedNews({
      title: "翻譯後標題",
      content: "<p>翻譯後內容</p>",
      imageFileName: "abc.jpg",
      sourceUrl: "https://www.herbots.be/en/article/a",
      originalTitle: "Original Title",
      originalContent: "<p>Original content</p>",
      publishedAt,
    });

    expect(result).toEqual({ ok: true, id: 7 });
    expect(queryMock.mock.calls[0][0]).toContain("source, source_url, original_title, original_content, published_at");
    expect(queryMock.mock.calls[0][0]).toContain("'herbots'");
    expect(queryMock.mock.calls[0][1]).toEqual([
      "翻譯後標題",
      "abc.jpg",
      "<p>翻譯後內容</p>",
      "https://www.herbots.be/en/article/a",
      "Original Title",
      "<p>Original content</p>",
      publishedAt,
    ]);
  });
});

describe("listHomepageNewsCarousel", () => {
  it("returns manual posts first, filling remaining slots with herbots imports", async () => {
    const manualRow = { ...ROW, id: 1, source: "manual" as const };
    const herbotsRow = { ...ROW, id: 2, source: "herbots" as const, source_url: "https://www.herbots.be/en/article/a" };
    queryMock.mockResolvedValueOnce([[manualRow]]); // manual query
    queryMock.mockResolvedValueOnce([[herbotsRow]]); // herbots fill query

    const items = await listHomepageNewsCarousel(10);

    expect(items.map((i) => i.id)).toEqual([1, 2]);
    expect(queryMock.mock.calls[0][0]).toContain("WHERE source = 'manual'");
    expect(queryMock.mock.calls[0][1]).toEqual([10]);
    expect(queryMock.mock.calls[1][0]).toContain("WHERE source = 'herbots'");
    expect(queryMock.mock.calls[1][1]).toEqual([9]); // 10 - 1 manual already found
  });

  it("skips the herbots fill query entirely once manual posts already fill the limit", async () => {
    const manualRows = Array.from({ length: 10 }, (_, i) => ({ ...ROW, id: i + 1, source: "manual" as const }));
    queryMock.mockResolvedValueOnce([manualRows]);

    const items = await listHomepageNewsCarousel(10);

    expect(items).toHaveLength(10);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});

describe("deleteNews", () => {
  it("returns ok:false when no row matched", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect(await deleteNews(1)).toEqual({ ok: false, error: "找不到這則訊息" });
  });

  it("returns ok:true when a row is deleted", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect(await deleteNews(1)).toEqual({ ok: true });
  });
});

describe("setNewsBroadcastId", () => {
  it("updates broadcast_id for the given post", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await setNewsBroadcastId(1, "bcast_2");

    expect(queryMock).toHaveBeenCalledWith("UPDATE news_posts SET broadcast_id = ? WHERE id = ?", ["bcast_2", 1]);
  });

  it("can clear the link back to NULL", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await setNewsBroadcastId(1, null);

    expect(queryMock).toHaveBeenCalledWith("UPDATE news_posts SET broadcast_id = ? WHERE id = ?", [null, 1]);
  });
});
