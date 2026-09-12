// herbots.be news scraper (issue #240).
//
// herbots.be/en/news is a JS-rendered SPA: the first page of articles is
// streamed in via Next.js Server Components (invisible to the browser's own
// network tab) and every subsequent page comes from its "Load more" button,
// which is wired to a plain public JSON API rather than another page
// render — confirmed by driving a real headless Chromium against the page
// and recording the request its own "Load more" click fires:
//
//   GET https://herbots.deltablue.io/api/news?type=news&language=en&per_page=25&page=2
//   GET https://herbots.deltablue.io/api/news/<id>?language=en   (article detail)
//
// Both endpoints are unauthenticated and return structured JSON (list items:
// id/title/mainImage/publishOn/translated_slugs; detail: paragraphs[] of
// HTML content) — far more robust than scraping the rendered DOM, whose
// class names are webpack content hashes that change on every herbots.be
// deploy (e.g. `Button_base__COZlw`).
//
// Originally driven through a real headless Chromium instance (Playwright)
// per issue #240's initial requirement, on the reasoning that a real browser
// would be more resilient to bot detection than a bare fetch. That
// requirement was dropped after production deploy planning surfaced a real
// cost (installing Chromium on the VPS — see #239's PR discussion): a direct
// `fetch()` call with the same realistic desktop-Chrome User-Agent below was
// verified live against this exact API and gets an identical 200 JSON
// response — there is no browser-fingerprinting/JS-challenge layer here to
// evade, just an unauthenticated public API, so the headless browser was
// pure overhead. Kept the same open()/close()/fetch* class shape as before
// (open/close are now no-ops) so lib/newsSync.ts didn't need to change.
const NEWS_API_BASE = "https://herbots.deltablue.io/api/news";
const ARTICLE_ORIGIN = "https://www.herbots.be";
const LANGUAGE = "en";
export const HERBOTS_PER_PAGE = 25;

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface HerbotsArticleSummary {
  id: number;
  /** Pre-translation (English) title. */
  title: string;
  /** Absolute URL on s3.herbots.be, or null when the article has no cover photo. */
  mainImage: string | null;
  /** Original publish timestamp, seconds since epoch. */
  publishOn: number;
  /** Absolute https://www.herbots.be/en/article/<slug> URL — the de-dup key. */
  sourceUrl: string;
}

export interface RawNewsListItem {
  id: number;
  title: string | null;
  mainImage: string | null;
  publishOn: number;
  translated_slugs?: { path: string; lang: string }[];
}

interface RawNewsListResponse {
  data: RawNewsListItem[];
  total: number;
  page: number;
  pages: number;
}

interface RawParagraph {
  content: string | null;
}

interface RawArticleDetail {
  id: number;
  paragraphs?: RawParagraph[];
}

interface RawArticleDetailResponse {
  data: RawArticleDetail[];
}

// Some rows (e.g. a Dutch-only "in memoriam" notice) have no English
// translation at all — title/mainImage come back null and every
// translated_slugs entry is the literal placeholder "no-slug". There is
// nothing to import for these, so callers should treat a null return as
// "skip this id" rather than an error.
// Exported for lib/herbotsNews.test.ts only — the rest of this file is thin
// fetch() I/O wiring (no test, same precedent as lib/httpsRequest.ts),
// but this mapping/filtering decision is pure logic worth pinning directly.
export function toSummary(item: RawNewsListItem): HerbotsArticleSummary | null {
  if (!item.title) return null;
  const enSlug = item.translated_slugs?.find((slug) => slug.lang === "en");
  if (!enSlug || !enSlug.path || enSlug.path.includes("no-slug")) return null;

  return {
    id: item.id,
    title: item.title,
    mainImage: item.mainImage,
    publishOn: item.publishOn,
    sourceUrl: `${ARTICLE_ORIGIN}${enSlug.path}`,
  };
}

// Plain fetch() client — see the file header comment for why this no longer
// needs a real browser. open()/close() are kept (as no-ops) purely so
// lib/newsSync.ts's existing "open once, fetch many, close in a finally"
// shape didn't need to change.
export class HerbotsNewsClient {
  async open(): Promise<void> {
    // no-op — plain fetch has no persistent browser/session to start.
  }

  async close(): Promise<void> {
    // no-op
  }

  // One page of the newest-first article list (herbots.be always returns
  // publishOn descending — verified against the live API), skipping any
  // item with no usable English translation.
  async fetchSummaries(page: number, perPage: number = HERBOTS_PER_PAGE): Promise<HerbotsArticleSummary[]> {
    const url = `${NEWS_API_BASE}?type=news&language=${LANGUAGE}&per_page=${perPage}&page=${page}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      throw new Error(`herbots.be news list request failed: HTTP ${response.status}`);
    }
    const body: RawNewsListResponse = await response.json();
    return body.data.map(toSummary).filter((item): item is HerbotsArticleSummary => item !== null);
  }

  // Full article body as raw (untranslated, unsanitized) HTML — the list
  // endpoint's own `shortDescription` field is a truncated teaser, not the
  // full article, so every imported article needs this second call. Returns
  // "" (never null/throws) when the article has no paragraphs, so a caller
  // can still store the title-only article rather than aborting the whole
  // sync run over one malformed entry.
  async fetchContentHtml(id: number): Promise<string> {
    const url = `${NEWS_API_BASE}/${id}?language=${LANGUAGE}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      throw new Error(`herbots.be article detail request failed (id=${id}): HTTP ${response.status}`);
    }
    const body: RawArticleDetailResponse = await response.json();
    const paragraphs = body.data[0]?.paragraphs ?? [];
    return paragraphs
      .map((p) => p.content ?? "")
      .filter((html) => html.trim().length > 0)
      .join("\n");
  }

  // Downloads a cover image (from mainImage, always an absolute s3.herbots.be
  // URL). Returns null (never throws) on a non-2xx response or a missing
  // content-type — lib/newsSync.ts treats that as "no cover image" rather
  // than aborting the whole article import.
  async fetchImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
      if (!contentType) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      return { buffer, contentType };
    } catch (error) {
      console.error(`[herbotsNews] cover image download failed (${url})`, error);
      return null;
    }
  }
}
