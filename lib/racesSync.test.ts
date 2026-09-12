// lib/racesSync.ts orchestrates several I/O modules (lib/loingMaRaces.ts,
// lib/herbotsRaces.ts, lib/translate.ts, lib/races.ts, lib/uploads.ts) — all
// mocked here, same "assert on the calls/results, not real I/O" style as
// lib/newsSync.test.ts. extractRaceDate/deriveLoingMaStatus are kept real
// (pure, no I/O, already covered by lib/loingMaRaces.test.ts) via
// importActual, so only the Playwright-backed client is mocked out.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loingOpenMock, loingCloseMock, fetchPageMock } = vi.hoisted(() => ({
  loingOpenMock: vi.fn(),
  loingCloseMock: vi.fn(),
  fetchPageMock: vi.fn(),
}));

vi.mock("@/lib/loingMaRaces", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./loingMaRaces")>();
  return {
    ...actual,
    LOING_MA_TOPICS_PER_PAGE: 30,
    LoingMaRacesClient: vi.fn(function LoingMaRacesClient(this: unknown) {
      return { open: loingOpenMock, close: loingCloseMock, fetchPage: fetchPageMock };
    }),
  };
});

const { herbotsOpenMock, herbotsCloseMock, fetchSummariesMock, fetchImageBufferMock } = vi.hoisted(() => ({
  herbotsOpenMock: vi.fn(),
  herbotsCloseMock: vi.fn(),
  fetchSummariesMock: vi.fn(),
  fetchImageBufferMock: vi.fn(),
}));

vi.mock("@/lib/herbotsRaces", () => ({
  HERBOTS_RACES_PER_PAGE: 24,
  HerbotsRacesClient: vi.fn(function HerbotsRacesClient(this: unknown) {
    return {
      open: herbotsOpenMock,
      close: herbotsCloseMock,
      fetchSummaries: fetchSummariesMock,
      fetchImageBuffer: fetchImageBufferMock,
    };
  }),
}));

const { upsertRaceMock } = vi.hoisted(() => ({ upsertRaceMock: vi.fn() }));
vi.mock("@/lib/races", () => ({
  upsertRace: upsertRaceMock,
}));

const { isTranslationConfiguredMock, translateToTraditionalChineseMock } = vi.hoisted(() => ({
  isTranslationConfiguredMock: vi.fn(),
  translateToTraditionalChineseMock: vi.fn(),
}));
vi.mock("@/lib/translate", () => ({
  isTranslationConfigured: isTranslationConfiguredMock,
  translateToTraditionalChinese: translateToTraditionalChineseMock,
}));

const { saveRaceImageFromBufferMock } = vi.hoisted(() => ({ saveRaceImageFromBufferMock: vi.fn() }));
vi.mock("@/lib/uploads", () => ({
  saveRaceImageFromBuffer: saveRaceImageFromBufferMock,
}));

import { syncRaces } from "./racesSync";

function loingTopic(id: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    topicId: id,
    title: `2026-07-0${id}測試賽事天氣`,
    contentText: `第 ${id} 關天氣內容`,
    postedAt: new Date("2026-07-01T08:00:00"),
    sourceUrl: `https://www.loing-ma.com/viewtopic.php?f=80&t=${id}`,
    ...overrides,
  };
}

function herbotsSummary(id: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    status: "current" as const,
    place: "Issoudun",
    category: "Yearling & Old",
    level: "National",
    basketingTime: 1788991200,
    releaseTime: 1789164000,
    winner: "",
    image: null,
    sourceUrl: `https://www.herbots.be/en/race/2026/issoudun-${id}/yearling-old`,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loingOpenMock.mockResolvedValue(undefined);
  loingCloseMock.mockResolvedValue(undefined);
  herbotsOpenMock.mockResolvedValue(undefined);
  herbotsCloseMock.mockResolvedValue(undefined);
  isTranslationConfiguredMock.mockReturnValue(true);
  translateToTraditionalChineseMock.mockImplementation(async (text: string) => ({ ok: true, text: `譯:${text}` }));
  upsertRaceMock.mockResolvedValue({ ok: true, inserted: true });
  fetchImageBufferMock.mockResolvedValue(null);
  // Default: no races from either source, so most tests only need to
  // override what they actually care about.
  fetchPageMock.mockResolvedValue([]);
  fetchSummariesMock.mockResolvedValue([]);
});

describe("syncRaces — loing-ma.com half", () => {
  it("upserts a new topic as a loing_ma race with a derived status/date, and stops once a page is short", async () => {
    // Only one page is ever fetched: a page with fewer topics than
    // LOING_MA_TOPICS_PER_PAGE is treated as the last page (see
    // lib/racesSync.ts), so no second fetchPage call happens here.
    fetchPageMock.mockResolvedValueOnce([loingTopic(1)]);

    const result = await syncRaces();

    expect(result.loingMa.imported).toBe(1);
    expect(result.loingMa.skipped).toBe(false);
    expect(upsertRaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "loing_ma",
        originalTitle: null,
        originalContent: null,
        sourceUrl: "https://www.loing-ma.com/viewtopic.php?f=80&t=1",
      }),
    );
    expect(loingOpenMock).toHaveBeenCalledTimes(1);
    expect(loingCloseMock).toHaveBeenCalledTimes(1);
  });

  it("marks the source skipped (not a hard failure) when the very first page request fails, e.g. still 403ing", async () => {
    fetchPageMock.mockRejectedValueOnce(new Error("loing-ma.com forum request failed: HTTP 403"));

    const result = await syncRaces();

    expect(result.loingMa.skipped).toBe(true);
    expect(result.loingMa.skipReason).toContain("403");
    expect(result.loingMa.errors).toEqual([]);
    expect(loingCloseMock).toHaveBeenCalledTimes(1);
    // The herbots.be half must still run — the failure must not block it.
    expect(herbotsOpenMock).toHaveBeenCalledTimes(1);
  });

  it("marks the source skipped when the browser itself fails to launch", async () => {
    loingOpenMock.mockRejectedValueOnce(new Error("chromium not installed"));

    const result = await syncRaces();

    expect(result.loingMa.skipped).toBe(true);
    expect(fetchPageMock).not.toHaveBeenCalled();
    expect(loingCloseMock).toHaveBeenCalledTimes(1);
  });

  it("records (not skips) a later-page failure, keeping whatever was already imported", async () => {
    fetchPageMock
      .mockResolvedValueOnce(Array.from({ length: 30 }, (_, i) => loingTopic(i + 1)))
      .mockRejectedValueOnce(new Error("HTTP 500"));

    const result = await syncRaces();

    expect(result.loingMa.skipped).toBe(false);
    expect(result.loingMa.imported).toBe(30);
    expect(result.loingMa.errors).toHaveLength(1);
  });
});

describe("syncRaces — herbots.be half", () => {
  it("upserts a translated race, falling back to English on translation failure", async () => {
    fetchSummariesMock.mockImplementation(async (status: string) =>
      status === "current" ? [herbotsSummary(1)] : [],
    );
    translateToTraditionalChineseMock.mockResolvedValue({ ok: false, error: "not configured" });

    const result = await syncRaces();

    expect(result.herbots.imported).toBe(1);
    expect(result.herbots.translationFailures).toBeGreaterThan(0);
    expect(upsertRaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "herbots",
        status: "current",
        originalTitle: "Issoudun (Yearling & Old)",
        // Falls back to the escaped original text on translation failure —
        // same escapeHtml-then-store convention as lib/newsSync.ts's
        // translateOrFallback (title/content are both run through it there
        // too).
        title: "Issoudun (Yearling &amp; Old)",
      }),
    );
  });

  it("skips just one status bucket (e.g. future 404ing) without aborting the others", async () => {
    fetchSummariesMock.mockImplementation(async (status: string) => {
      if (status === "future") throw new Error("herbots.be races list request failed (type=future): HTTP 404");
      if (status === "current") return [herbotsSummary(1)];
      return [];
    });

    const result = await syncRaces();

    expect(result.herbots.imported).toBe(1);
    expect(result.herbots.errors.some((e) => e.includes("future"))).toBe(true);
  });

  it("downloads and stores the winner photo when present", async () => {
    fetchSummariesMock.mockImplementation(async (status: string) =>
      status === "finished" ? [herbotsSummary(1, { status: "finished", winner: "PEETERS", image: "https://s3.herbots.be/a.jpg" })] : [],
    );
    const buffer = Buffer.from("fake-image-bytes");
    fetchImageBufferMock.mockResolvedValueOnce({ buffer, contentType: "image/jpeg" });
    saveRaceImageFromBufferMock.mockResolvedValueOnce("saved-race.jpg");

    await syncRaces();

    expect(fetchImageBufferMock).toHaveBeenCalledWith("https://s3.herbots.be/a.jpg");
    expect(upsertRaceMock).toHaveBeenCalledWith(expect.objectContaining({ imageFileName: "saved-race.jpg" }));
  });

  it("aborts just the herbots.be half when its browser fails to launch, without affecting loing-ma.com", async () => {
    herbotsOpenMock.mockRejectedValueOnce(new Error("chromium not installed"));
    fetchPageMock.mockResolvedValueOnce([loingTopic(1)]).mockResolvedValueOnce([]);

    const result = await syncRaces();

    expect(result.herbots.errors[0]).toContain("Playwright");
    expect(fetchSummariesMock).not.toHaveBeenCalled();
    expect(result.loingMa.imported).toBe(1);
  });

  it("records one race's upsert failure without aborting the rest of the run", async () => {
    fetchSummariesMock.mockImplementation(async (status: string) =>
      status === "current" ? [herbotsSummary(1), herbotsSummary(2)] : [],
    );
    upsertRaceMock
      .mockResolvedValueOnce({ ok: false, error: "duplicate" })
      .mockResolvedValueOnce({ ok: true, inserted: true });

    const result = await syncRaces();

    expect(result.herbots.imported).toBe(1);
    expect(result.herbots.errors).toHaveLength(1);
  });
});
