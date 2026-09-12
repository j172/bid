// Raw-SQL CRUD (no ORM) — same mocked-getDb style as lib/news.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasImportedSourceUrl, recordImportedSourceUrl } from "./newsImportLog";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe("hasImportedSourceUrl", () => {
  it("returns true when a matching row exists", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]);
    expect(await hasImportedSourceUrl("https://www.herbots.be/en/article/a")).toBe(true);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("FROM news_import_log WHERE source_url = ?"), [
      "https://www.herbots.be/en/article/a",
    ]);
  });

  it("returns false when no row matches", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await hasImportedSourceUrl("https://www.herbots.be/en/article/missing")).toBe(false);
  });
});

describe("recordImportedSourceUrl", () => {
  it("inserts a ledger row keyed by source_url, upserting the news_post_id on a repeat", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 1 }]);

    await recordImportedSourceUrl("herbots", "https://www.herbots.be/en/article/a", 42);

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO news_import_log"),
      ["herbots", "https://www.herbots.be/en/article/a", 42],
    );
    expect(queryMock.mock.calls[0][0]).toContain("ON DUPLICATE KEY UPDATE news_post_id = VALUES(news_post_id)");
  });
});
