// lib/news.ts is raw-SQL CRUD (no ORM, see its own header comment), so like
// lib/pigeonShowcase.test.ts this mocks @/lib/db's getDb() and asserts on
// the SQL/params each function sends plus how it maps mysql2's raw
// rows/results back into the module's public shapes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNews, deleteNews, getNewsById, listLatestNews, listNews, setNewsBroadcastId, updateNews } from "./news";

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
        createdAt: ROW.created_at,
        updatedAt: ROW.updated_at,
      },
    ]);
  });

  it("orders newest-first and paginates using the requested page size", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listNews({ page: 2, pageSize: 50 });

    expect(queryMock.mock.calls[1][0]).toContain("ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET 50");
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

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY created_at DESC, id DESC LIMIT ?"), [10]);
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
