// loing-ma.com (龍馬賽鴿網) 時事快訊 forum scraper (issue #241) — Taiwan/Asia
// races. A request to this forum with no headers at all (e.g. this
// project's earlier bare WebFetch probe) returns HTTP 403 — but that turned
// out to be plain User-Agent sniffing, not real bot-fingerprinting/JS-
// challenge protection: a bare `fetch()` carrying the realistic desktop
// Chrome User-Agent below was verified live to return 200 with real forum
// content (not a bot-block page), identical to what the headless-Chromium
// version originally required by this issue got. Switched away from
// Playwright once VPS deploy planning made Chromium-on-the-server a real
// cost (see #239) — see lib/racesSync.ts for what happens on the day plain
// fetch *does* start getting blocked again (logged warning, source skipped
// for that run, the herbots.be half of the sync still proceeds).
//
// The forum is plain server-rendered phpBB-style HTML (no JS rendering
// needed for content) — inspected directly before writing this parser. Each
// topic's own listing-page teaser (`p.topic_text.gen`) already contains the
// full post body (verified: no truncation marker on any topic across a full
// page, lengths vary naturally), so no second per-topic detail-page request
// is needed the way lib/herbotsNews.ts needs one for full article bodies —
// one list-page fetch is enough per page of results.
import * as cheerio from "cheerio";
import type { RaceStatus } from "@/lib/races";

const FORUM_ORIGIN = "https://www.loing-ma.com";
const FORUM_ID = 80; // 時事快訊
export const LOING_MA_TOPICS_PER_PAGE = 30; // phpBB's own per-page size for this forum

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface LoingMaTopicSummary {
  topicId: number;
  /** Already Traditional Chinese — no translation needed for this source. */
  title: string;
  /** Full post body, plain text (HTML-escaped by the caller before storage). */
  contentText: string;
  /** This topic's own post timestamp — used as the race-date fallback when the title has no parseable date. */
  postedAt: Date;
  sourceUrl: string;
}

// Titles observed on the live forum embed the race date as a leading
// "YYYY-MM-DD" or bare "M-D" token (year omitted on some older topics,
// e.g. "7-20第五關颱風延關") — extracted here so lib/racesSync.ts can derive
// this source's status (issue #241: "loing-ma.com 論壇需依開賽日期自行判斷所
// 屬狀態") without a structured date field, which this forum simply doesn't
// have. Exported for lib/loingMaRaces.test.ts only — the rest of this file is
// thin fetch() I/O wiring (no test, same precedent as lib/herbotsNews.ts).
export function extractRaceDate(title: string, postedAt: Date): Date {
  const withYear = title.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (withYear) {
    const [, year, month, day] = withYear;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const withoutYear = title.match(/^(\d{1,2})-(\d{1,2})(?!\d)/);
  if (withoutYear) {
    const [, month, day] = withoutYear;
    // No year in the title — this forum's topics are posted the same day the
    // race/weather bulletin happens (verified against the live site), so the
    // post's own year is the correct proxy.
    return new Date(postedAt.getFullYear(), Number(month) - 1, Number(day));
  }

  // No parseable date at all (rare) — fall back to the post's own date.
  return postedAt;
}

// yyyy-mm-dd in Asia/Taipei, for comparing a race_date against "today"
// regardless of the server process's own timezone.
function taipeiDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date);
}

// issue #241: herbots.be rows copy their status straight from whichever
// current/future/finished collection they were scraped from; loing-ma.com
// has no such collection, so it's derived here by comparing the parsed
// race_date against "today" (Asia/Taipei, matching lib/scheduler.ts's own
// timezone). Exported alongside extractRaceDate for the same test-only
// reason.
export function deriveLoingMaStatus(raceDate: Date, now: Date): RaceStatus {
  const raceKey = taipeiDateKey(raceDate);
  const nowKey = taipeiDateKey(now);
  if (raceKey === nowKey) return "current";
  return raceKey > nowKey ? "future" : "finished";
}

// Parses one viewforum.php listing page into topic summaries. Pure function
// (fed real HTML via the client below, fixture HTML in
// lib/loingMaRaces.test.ts) — cheerio, not regex, since sanitize-html's
// sibling `cheerio` dependency is already in this project (used by
// scripts/import-pigeon-shops.mjs) and this markup has no stable ids/classes
// worth hand-rolling a regex against.
export function parseLoingMaForumPage(html: string): LoingMaTopicSummary[] {
  const $ = cheerio.load(html);
  const topics: LoingMaTopicSummary[] = [];

  $(".row").each((_, el) => {
    const row = $(el);
    const link = row.find("a.topictitle").first();
    if (link.length === 0) return; // this .row isn't a topic block (e.g. the pagination row)

    const href = link.attr("href") ?? "";
    const idMatch = href.match(/[?&]t=(\d+)/);
    if (!idMatch) return;

    const title = link.text().trim();
    const contentText = row.find("p.topic_text").first().text().trim();
    const timeText = row.find("span.time").first().text().trim();
    const postedAt = timeText ? new Date(timeText.replace(" ", "T")) : new Date();

    topics.push({
      topicId: Number(idMatch[1]),
      title,
      contentText,
      postedAt: Number.isNaN(postedAt.getTime()) ? new Date() : postedAt,
      sourceUrl: `${FORUM_ORIGIN}/viewtopic.php?f=${FORUM_ID}&t=${idMatch[1]}`,
    });
  });

  return topics;
}

// Plain fetch() client, same open()/close()-as-no-ops shape as
// lib/herbotsNews.ts's HerbotsNewsClient — kept purely so lib/racesSync.ts's
// existing call sites didn't need to change. fetchPage throws on a non-2xx
// response or a network error — lib/racesSync.ts decides what that means
// (abort just this source, with a logged warning, never the whole sync run).
export class LoingMaRacesClient {
  async open(): Promise<void> {
    // no-op — plain fetch has no persistent browser/session to start.
  }

  async close(): Promise<void> {
    // no-op
  }

  async fetchPage(page: number): Promise<LoingMaTopicSummary[]> {
    const start = (page - 1) * LOING_MA_TOPICS_PER_PAGE;
    const url = `${FORUM_ORIGIN}/viewforum.php?f=${FORUM_ID}&start=${start}`;
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      throw new Error(`loing-ma.com forum request failed: HTTP ${response.status}`);
    }
    const html = await response.text();
    return parseLoingMaForumPage(html);
  }
}
