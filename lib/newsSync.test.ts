// lib/newsSync.ts orchestrates several I/O modules (lib/herbotsNews.ts,
// lib/translate.ts, lib/newsImportLog.ts, lib/news.ts, lib/uploads.ts) — all
// mocked here, same "assert on the calls/results, not real I/O" style as
// lib/newsNewsletterSync.test.ts. sanitizeDescriptionHtml is left real
// (pure, no I/O) so paragraph-splitting behavior is exercised faithfully.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openMock, closeMock, fetchSummariesMock, fetchContentHtmlMock, fetchImageBufferMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  closeMock: vi.fn(),
  fetchSummariesMock: vi.fn(),
  fetchContentHtmlMock: vi.fn(),
  fetchImageBufferMock: vi.fn(),
}));

vi.mock("@/lib/herbotsNews", () => ({
  HERBOTS_PER_PAGE: 25,
  // A real `function`, not an arrow, so `new HerbotsNewsClient()` in
  // lib/newsSync.ts can actually construct it (arrow functions can't be
  // used with `new`) — the returned object becomes the instance per JS's
  // "constructor explicitly returns an object" rule.
  HerbotsNewsClient: vi.fn(function HerbotsNewsClient(this: unknown) {
    return {
      open: openMock,
      close: closeMock,
      fetchSummaries: fetchSummariesMock,
      fetchContentHtml: fetchContentHtmlMock,
      fetchImageBuffer: fetchImageBufferMock,
    };
  }),
}));

const { hasImportedSourceUrlMock, recordImportedSourceUrlMock } = vi.hoisted(() => ({
  hasImportedSourceUrlMock: vi.fn(),
  recordImportedSourceUrlMock: vi.fn(),
}));
vi.mock("@/lib/newsImportLog", () => ({
  hasImportedSourceUrl: hasImportedSourceUrlMock,
  recordImportedSourceUrl: recordImportedSourceUrlMock,
}));

const { createImportedNewsMock } = vi.hoisted(() => ({ createImportedNewsMock: vi.fn() }));
vi.mock("@/lib/news", () => ({
  createImportedNews: createImportedNewsMock,
}));

const { isTranslationConfiguredMock, translateToTraditionalChineseMock } = vi.hoisted(() => ({
  isTranslationConfiguredMock: vi.fn(),
  translateToTraditionalChineseMock: vi.fn(),
}));
vi.mock("@/lib/translate", () => ({
  isTranslationConfigured: isTranslationConfiguredMock,
  translateToTraditionalChinese: translateToTraditionalChineseMock,
}));

const { saveNewsImageFromBufferMock } = vi.hoisted(() => ({ saveNewsImageFromBufferMock: vi.fn() }));
vi.mock("@/lib/uploads", () => ({
  saveNewsImageFromBuffer: saveNewsImageFromBufferMock,
}));

import { syncHerbotsNews } from "./newsSync";

function summary(id: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    title: `Article ${id}`,
    mainImage: null,
    publishOn: 1788878580,
    sourceUrl: `https://www.herbots.be/en/article/a${id}`,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  openMock.mockResolvedValue(undefined);
  closeMock.mockResolvedValue(undefined);
  isTranslationConfiguredMock.mockReturnValue(true);
  translateToTraditionalChineseMock.mockImplementation(async (text: string) => ({ ok: true, text: `譯:${text}` }));
  createImportedNewsMock.mockResolvedValue({ ok: true, id: 1 });
  recordImportedSourceUrlMock.mockResolvedValue(undefined);
  hasImportedSourceUrlMock.mockResolvedValue(false);
  fetchImageBufferMock.mockResolvedValue(null);
});

describe("syncHerbotsNews", () => {
  it("imports a new article: translates, records the import log, and stops once a page has nothing left", async () => {
    fetchSummariesMock.mockResolvedValueOnce([summary(1)]).mockResolvedValueOnce([]);
    fetchContentHtmlMock.mockResolvedValueOnce("<p>Hello world</p>");
    createImportedNewsMock.mockResolvedValueOnce({ ok: true, id: 99 });

    const result = await syncHerbotsNews();

    expect(result.imported).toBe(1);
    expect(result.skippedExisting).toBe(0);
    expect(result.skippedNoContent).toBe(0);
    expect(result.translationFailures).toBe(0);
    expect(result.errors).toEqual([]);

    expect(createImportedNewsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceUrl: "https://www.herbots.be/en/article/a1",
        originalTitle: "Article 1",
        title: "譯:Article 1",
      }),
    );
    expect(recordImportedSourceUrlMock).toHaveBeenCalledWith("herbots", "https://www.herbots.be/en/article/a1", 99);
    expect(openMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("skips an already-imported source_url without fetching its content", async () => {
    fetchSummariesMock.mockResolvedValueOnce([summary(1)]).mockResolvedValueOnce([]);
    hasImportedSourceUrlMock.mockResolvedValueOnce(true);

    const result = await syncHerbotsNews();

    expect(result.skippedExisting).toBe(1);
    expect(result.imported).toBe(0);
    expect(fetchContentHtmlMock).not.toHaveBeenCalled();
    expect(createImportedNewsMock).not.toHaveBeenCalled();
  });

  it("skips an article with no usable body instead of inserting an empty row", async () => {
    fetchSummariesMock.mockResolvedValueOnce([summary(1)]).mockResolvedValueOnce([]);
    fetchContentHtmlMock.mockResolvedValueOnce("");

    const result = await syncHerbotsNews();

    expect(result.skippedNoContent).toBe(1);
    expect(createImportedNewsMock).not.toHaveBeenCalled();
  });

  it("falls back to the original text (still importing) when translation fails, and counts the failure", async () => {
    fetchSummariesMock.mockResolvedValueOnce([summary(1)]).mockResolvedValueOnce([]);
    fetchContentHtmlMock.mockResolvedValueOnce("<p>Hello world</p>");
    translateToTraditionalChineseMock.mockResolvedValue({ ok: false, error: "not configured" });

    const result = await syncHerbotsNews();

    expect(result.imported).toBe(1);
    expect(result.translationFailures).toBeGreaterThan(0);
    expect(createImportedNewsMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Article 1", content: expect.stringContaining("Hello world") }),
    );
  });

  it("downloads and stores the cover image when the source article has one", async () => {
    fetchSummariesMock
      .mockResolvedValueOnce([summary(1, { mainImage: "https://s3.herbots.be/a.jpg" })])
      .mockResolvedValueOnce([]);
    fetchContentHtmlMock.mockResolvedValueOnce("<p>Hello</p>");
    const buffer = Buffer.from("fake-image-bytes");
    fetchImageBufferMock.mockResolvedValueOnce({ buffer, contentType: "image/jpeg" });
    saveNewsImageFromBufferMock.mockResolvedValueOnce("saved-file.jpg");

    await syncHerbotsNews();

    expect(fetchImageBufferMock).toHaveBeenCalledWith("https://s3.herbots.be/a.jpg");
    expect(saveNewsImageFromBufferMock).toHaveBeenCalledWith(buffer, "image/jpeg");
    expect(createImportedNewsMock).toHaveBeenCalledWith(expect.objectContaining({ imageFileName: "saved-file.jpg" }));
  });

  it("stores a null imageFileName when the article has no cover image", async () => {
    fetchSummariesMock.mockResolvedValueOnce([summary(1)]).mockResolvedValueOnce([]);
    fetchContentHtmlMock.mockResolvedValueOnce("<p>Hello</p>");

    await syncHerbotsNews();

    expect(fetchImageBufferMock).not.toHaveBeenCalled();
    expect(createImportedNewsMock).toHaveBeenCalledWith(expect.objectContaining({ imageFileName: null }));
  });

  it("stops paginating once a page (after the first) yields zero new articles", async () => {
    fetchSummariesMock
      .mockResolvedValueOnce([summary(1)])
      .mockResolvedValueOnce([summary(2)]); // page 2, but already imported below
    fetchContentHtmlMock.mockResolvedValueOnce("<p>Hello</p>");
    hasImportedSourceUrlMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await syncHerbotsNews();

    expect(fetchSummariesMock).toHaveBeenCalledTimes(2);
  });

  it("records a page-fetch error and stops paginating rather than throwing", async () => {
    fetchSummariesMock.mockRejectedValueOnce(new Error("HTTP 500"));

    const result = await syncHerbotsNews();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("HTTP 500");
    expect(fetchSummariesMock).toHaveBeenCalledTimes(1);
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("records a launch failure and still closes the client, without throwing", async () => {
    openMock.mockRejectedValueOnce(new Error("chromium not installed"));

    const result = await syncHerbotsNews();

    expect(result.errors[0]).toContain("Playwright");
    expect(fetchSummariesMock).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it("records one article's insert failure without aborting the rest of the run", async () => {
    fetchSummariesMock.mockResolvedValueOnce([summary(1), summary(2)]).mockResolvedValueOnce([]);
    fetchContentHtmlMock.mockResolvedValue("<p>Hello</p>");
    createImportedNewsMock.mockResolvedValueOnce({ ok: false, error: "duplicate" }).mockResolvedValueOnce({ ok: true, id: 2 });

    const result = await syncHerbotsNews();

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
  });
});
