// lib/syncRuns.ts is raw-SQL read/write (no ORM) plus one pure function —
// same split as lib/exchangeRates.ts. getLastRunAt/recordRunNow mock @/lib/db
// the same way lib/homepageSections.test.ts does; isSyncStale needs no
// mocking at all since it's pure (see lib/scheduler.ts for why this matters:
// its post-boot catch-up decision has to be directly unit-testable).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLastRunAt, isSyncStale, recordRunNow } from "./syncRuns";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

describe("getLastRunAt", () => {
  it("returns the stored timestamp for a job that has run before", async () => {
    queryMock.mockResolvedValueOnce([[{ last_run_at: new Date("2026-09-10T08:40:00Z") }]]);

    const result = await getLastRunAt("news");

    expect(queryMock).toHaveBeenCalledWith("SELECT last_run_at FROM sync_runs WHERE job_name = ?", ["news"]);
    expect(result).toEqual(new Date("2026-09-10T08:40:00Z"));
  });

  it("returns null when the job has never recorded a run", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const result = await getLastRunAt("races");

    expect(result).toBeNull();
  });
});

describe("recordRunNow", () => {
  it("upserts the job's row to the current server time", async () => {
    queryMock.mockResolvedValueOnce([{}]);

    await recordRunNow("news");

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO sync_runs"), ["news"]);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ON DUPLICATE KEY UPDATE"), ["news"]);
  });
});

describe("isSyncStale", () => {
  const now = new Date("2026-09-13T00:00:00Z");

  it("is stale when the job has never run (lastRunAt is null)", () => {
    expect(isSyncStale(null, now, 20)).toBe(true);
  });

  it("is not stale when the last run is within the threshold", () => {
    const lastRunAt = new Date("2026-09-12T12:00:00Z"); // 12h ago
    expect(isSyncStale(lastRunAt, now, 20)).toBe(false);
  });

  it("is stale when the last run is older than the threshold", () => {
    const lastRunAt = new Date("2026-09-12T00:00:00Z"); // 24h ago
    expect(isSyncStale(lastRunAt, now, 20)).toBe(true);
  });

  it("is not yet stale exactly at the threshold boundary", () => {
    const lastRunAt = new Date("2026-09-12T04:00:00Z"); // exactly 20h ago
    expect(isSyncStale(lastRunAt, now, 20)).toBe(false);
  });
});
