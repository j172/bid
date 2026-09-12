// herbots.be races scraper (issue #241) — European races.
//
// https://www.herbots.be/en/races/{current,future,finished} is the same
// JS-rendered Next.js site as herbots.be/en/news (lib/herbotsNews.ts), but —
// checked directly before writing this file, per the issue's explicit
// instruction not to assume — its race listing is actually rendered
// server-side into the initial HTML (a plain, unauthenticated fetch of any
// of the three pages already contains the race cards), and its "Load more"
// button (present once a status has more than one page of results, e.g.
// /races/finished) is wired to the same style of plain public JSON API
// discovered for the news "Load more" button:
//
//   GET https://herbots.deltablue.io/api/pigeon-races?type=finished&language=en&per_page=24&page=2
//
// confirmed by driving a real headless Chromium against /races/finished and
// recording the network request its own "Load more" click fires. `type`
// accepts 'current' and 'finished' (both verified against the live API);
// `type=future` currently 404s ("auction.item.not_found") rather than
// returning an empty list — the live /races/future page shows a genuine
// "No races found" empty state with zero herbots.deltablue.io requests of
// its own, so there is no way to observe what a populated "future" bucket's
// real network call would look like from this environment. Per this ticket's
// own resilience requirement for loing-ma.com, a failing status bucket here
// is treated the same way: log a warning and skip just that bucket for this
// run (see lib/racesSync.ts), not the whole herbots.be half of the sync. If
// herbots.be ever starts publishing real future-race data with a working
// `type` value, this starts returning it automatically with no code change,
// since the same endpoint is already called daily.
//
// Every request below goes through Playwright's own browser request context
// (not a bare fetch/https call) for the same reason lib/herbotsNews.ts does —
// see that file's header comment.
import { chromium, type Browser, type BrowserContext } from "playwright";
import type { RaceStatus } from "@/lib/races";

const RACES_API_BASE = "https://herbots.deltablue.io/api/pigeon-races";
const RACE_ORIGIN = "https://www.herbots.be";
const LANGUAGE = "en";
export const HERBOTS_RACES_PER_PAGE = 24;

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface HerbotsRaceSummary {
  id: number;
  status: RaceStatus;
  /** Race location, e.g. "Issoudun" — combined with `category` for a unique, human-readable title. */
  place: string;
  category: string;
  level: string;
  /** Seconds since epoch — when pigeons are basketed, one day before release. */
  basketingTime: number;
  /** Seconds since epoch — when pigeons are released; used as this race's race_date. */
  releaseTime: number;
  /** Winning loft, or "" when the race has no result yet (current/future races). */
  winner: string;
  /** Absolute s3.herbots.be URL of the winner's loft photo, or null. */
  image: string | null;
  /** Absolute https://www.herbots.be/en/race/... URL — the de-dup/upsert key. */
  sourceUrl: string;
}

interface RawPigeonRace {
  id: number;
  title: string | null;
  translated_slugs?: { path: string; lang: string }[];
  basketing_time: number;
  release_time: number;
  winner: string;
  category: string;
  level: string;
  image: string | null;
}

interface RawPigeonRacesResponse {
  data: RawPigeonRace[];
  total: number;
  page: number;
  pages: number;
}

// Exported for lib/herbotsRaces.test.ts only — the rest of this file is thin
// Playwright I/O wiring (no test), same precedent as lib/herbotsNews.ts's
// toSummary.
export function toRaceSummary(item: RawPigeonRace, status: RaceStatus): HerbotsRaceSummary | null {
  if (!item.title) return null;
  const enSlug = item.translated_slugs?.find((slug) => slug.lang === "en");
  if (!enSlug || !enSlug.path) return null;

  return {
    id: item.id,
    status,
    place: item.title,
    category: item.category,
    level: item.level,
    basketingTime: item.basketing_time,
    releaseTime: item.release_time,
    winner: item.winner,
    image: item.image,
    sourceUrl: `${RACE_ORIGIN}${enSlug.path}`,
  };
}

// Thin wrapper around one headless Chromium instance, same shape as
// lib/herbotsNews.ts's HerbotsNewsClient (and lib/loingMaRaces.ts's
// LoingMaRacesClient) — one browser launch pays for every request a sync run
// needs, across however many status buckets/pages it fetches.
export class HerbotsRacesClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async open(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.context = await this.browser.newContext({ userAgent: USER_AGENT });
  }

  async close(): Promise<void> {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
    this.context = null;
    this.browser = null;
  }

  private requireContext(): BrowserContext {
    if (!this.context) {
      throw new Error("HerbotsRacesClient: call open() before making requests");
    }
    return this.context;
  }

  // Throws on a non-2xx response (including the known type=future 404 — see
  // this file's header comment) or a network error; lib/racesSync.ts decides
  // what that means (skip just this one status bucket, with a logged
  // warning, and keep going with the others).
  async fetchSummaries(
    status: RaceStatus,
    page: number,
    perPage: number = HERBOTS_RACES_PER_PAGE,
  ): Promise<HerbotsRaceSummary[]> {
    const context = this.requireContext();
    const url = `${RACES_API_BASE}?type=${status}&language=${LANGUAGE}&per_page=${perPage}&page=${page}`;
    const response = await context.request.get(url);
    if (!response.ok()) {
      throw new Error(`herbots.be races list request failed (type=${status}): HTTP ${response.status()}`);
    }
    const body: RawPigeonRacesResponse = await response.json();
    return body.data.map((item) => toRaceSummary(item, status)).filter((item): item is HerbotsRaceSummary => item !== null);
  }

  // Downloads the winner's loft photo through the same browser network
  // context as every other request in this class. Returns null (never
  // throws) on a non-2xx response or a missing content-type — lib/racesSync.ts
  // treats that the same as "no cover image" rather than aborting the import.
  async fetchImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const context = this.requireContext();
    try {
      const response = await context.request.get(url);
      if (!response.ok()) return null;
      const contentType = response.headers()["content-type"]?.split(";")[0]?.trim();
      if (!contentType) return null;
      return { buffer: await response.body(), contentType };
    } catch (error) {
      console.error(`[herbotsRaces] cover image download failed (${url})`, error);
      return null;
    }
  }
}
