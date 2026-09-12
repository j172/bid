// lib/races.ts is raw-SQL CRUD (no ORM, see its own header comment), same
// mocked-getDb style as lib/news.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isRaceStatus, listHomepageRaces, listRaces, upsertRace } from "./races";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

const ROW = {
  id: 1,
  source: "herbots" as const,
  status: "current" as const,
  title: "伊蘇丹 (老鴿)",
  original_title: "Issoudun (Yearling & Old)",
  content: "<p>等級：National</p>",
  original_content: "<p>Level: National</p>",
  race_date: new Date("2026-09-12T06:00:00Z"),
  image_file_name: null,
  source_url: "https://www.herbots.be/en/race/2026/issoudun-8/yearling-old",
  created_at: new Date("2026-09-01T00:00:00Z"),
  updated_at: new Date("2026-09-02T00:00:00Z"),
};

describe("isRaceStatus", () => {
  it("accepts the three known statuses and rejects anything else", () => {
    expect(isRaceStatus("current")).toBe(true);
    expect(isRaceStatus("future")).toBe(true);
    expect(isRaceStatus("finished")).toBe(true);
    expect(isRaceStatus("cancelled")).toBe(false);
  });
});

describe("listRaces", () => {
  it("filters by status, mapping snake_case rows to the public shape", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    queryMock.mockResolvedValueOnce([[ROW]]);

    const { items, total } = await listRaces({ status: "current" });

    expect(total).toBe(1);
    expect(queryMock.mock.calls[0][0]).toContain("WHERE status = ?");
    expect(queryMock.mock.calls[0][1]).toEqual(["current"]);
    expect(items).toEqual([
      {
        id: 1,
        source: "herbots",
        status: "current",
        title: "伊蘇丹 (老鴿)",
        originalTitle: "Issoudun (Yearling & Old)",
        content: "<p>等級：National</p>",
        originalContent: "<p>Level: National</p>",
        raceDate: ROW.race_date,
        imageFileName: null,
        sourceUrl: ROW.source_url,
        createdAt: ROW.created_at,
        updatedAt: ROW.updated_at,
      },
    ]);
  });

  it("lists every status together when no filter is given", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listRaces();

    expect(queryMock.mock.calls[0][0]).not.toContain("WHERE");
  });

  it("sorts by race_date, pushing NULL dates last", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([[]]);

    await listRaces();

    expect(queryMock.mock.calls[1][0]).toContain("ORDER BY race_date IS NULL, race_date DESC, id DESC");
  });
});

describe("listHomepageRaces", () => {
  it("orders current before future before finished, then by race_date", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    const items = await listHomepageRaces(6);

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("FIELD(status, 'current', 'future', 'finished')"), [
      6,
    ]);
    expect(items).toHaveLength(1);
  });
});

describe("upsertRace", () => {
  const INPUT = {
    source: "herbots" as const,
    status: "current" as const,
    title: "伊蘇丹 (老鴿)",
    originalTitle: "Issoudun (Yearling & Old)",
    content: "<p>等級：National</p>",
    originalContent: "<p>Level: National</p>",
    raceDate: new Date("2026-09-12T06:00:00Z"),
    imageFileName: null,
    sourceUrl: "https://www.herbots.be/en/race/2026/issoudun-8/yearling-old",
  };

  it("reports a fresh insert (affectedRows === 1) as inserted", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const outcome = await upsertRace(INPUT);

    expect(outcome).toEqual({ ok: true, inserted: true });
    expect(queryMock.mock.calls[0][0]).toContain("ON DUPLICATE KEY UPDATE");
    expect(queryMock.mock.calls[0][1]).toEqual([
      INPUT.source,
      INPUT.status,
      INPUT.title,
      INPUT.originalTitle,
      INPUT.content,
      INPUT.originalContent,
      INPUT.raceDate,
      INPUT.imageFileName,
      INPUT.sourceUrl,
    ]);
  });

  it("reports an update to an existing row (affectedRows === 2) as not inserted", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 2 }]);

    const outcome = await upsertRace(INPUT);

    expect(outcome).toEqual({ ok: true, inserted: false });
  });

  it("reports an unchanged existing row (affectedRows === 0) as not inserted", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const outcome = await upsertRace(INPUT);

    expect(outcome).toEqual({ ok: true, inserted: false });
  });

  it("returns ok:false rather than throwing when the query rejects", async () => {
    queryMock.mockRejectedValueOnce(new Error("connection lost"));

    const outcome = await upsertRace(INPUT);

    expect(outcome).toEqual({ ok: false, error: "connection lost" });
  });
});
