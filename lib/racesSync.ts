// Daily races sync (issue #241) — two independent regional sources into one
// `races` table, orchestrating lib/loingMaRaces.ts + lib/herbotsRaces.ts
// (scrape), lib/translate.ts (Cloudflare Workers AI, herbots.be half only)
// and lib/races.ts (upsert). See lib/scheduler.ts for when this runs (same
// daily batch as lib/newsSync.ts, per the issue).
//
// Whole-run error handling follows lib/newsSync.ts's convention: this
// function itself never throws for a "normal" failure — a blocked/403'd
// source, a single race's translation failing, one status bucket's list
// request erroring — every failure is caught, logged, and folded into the
// returned RacesSyncResult, so a bad page or a fully-unavailable source can
// never take the other source's half of the sync down with it (issue #241's
// explicit requirement for the loing-ma.com 403 case, applied symmetrically
// to herbots.be's own per-status-bucket failures too).
import { escapeHtml } from "@/lib/htmlText";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  HerbotsRacesClient,
  HERBOTS_RACES_PER_PAGE,
  type HerbotsRaceSummary,
} from "@/lib/herbotsRaces";
import {
  LoingMaRacesClient,
  deriveLoingMaStatus,
  extractRaceDate,
  LOING_MA_TOPICS_PER_PAGE,
  type LoingMaTopicSummary,
} from "@/lib/loingMaRaces";
import { upsertRace, type RaceStatus } from "@/lib/races";
import { isTranslationConfigured, translateToTraditionalChinese } from "@/lib/translate";
import { saveRaceImageFromBuffer } from "@/lib/uploads";

// Same reasoning as lib/newsSync.ts's MAX_PAGES: bounds one sync run's worst
// case while the ordinary case (a handful of new races since yesterday)
// exits after page 1 via the early-stop rule below.
const MAX_PAGES = 3;
const HERBOTS_STATUSES: readonly RaceStatus[] = ["current", "future", "finished"];

export interface SourceSyncResult {
  imported: number;
  updated: number;
  errors: string[];
}

export interface LoingMaSyncResult extends SourceSyncResult {
  /** true when the source was unavailable this run (e.g. still 403ing after the Playwright attempt) — not a crash, see lib/loingMaRaces.ts's header comment. */
  skipped: boolean;
  skipReason?: string;
}

export interface HerbotsSyncResult extends SourceSyncResult {
  translationFailures: number;
}

export interface RacesSyncResult {
  loingMa: LoingMaSyncResult;
  herbots: HerbotsSyncResult;
}

function emptyLoingMaResult(): LoingMaSyncResult {
  return { imported: 0, updated: 0, errors: [], skipped: false };
}

function emptyHerbotsResult(): HerbotsSyncResult {
  return { imported: 0, updated: 0, errors: [], translationFailures: 0 };
}

async function syncLoingMaRaces(): Promise<LoingMaSyncResult> {
  const result = emptyLoingMaResult();
  const client = new LoingMaRacesClient();

  try {
    try {
      await client.open();
    } catch (error) {
      result.skipped = true;
      result.skipReason = "無法啟動 Playwright headless browser";
      console.error("[racesSync] loing-ma.com chromium launch failed", error);
      return result;
    }

    for (let page = 1; page <= MAX_PAGES; page++) {
      let topics: LoingMaTopicSummary[];
      try {
        topics = await client.fetchPage(page);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (page === 1) {
          // issue #241's explicit requirement: a fetch failure (still 403ing
          // even via Playwright with realistic browser headers) skips this
          // source for the run with a logged warning — it must not crash or
          // block the herbots.be half of the sync.
          result.skipped = true;
          result.skipReason = message;
          console.error(`[racesSync] loing-ma.com forum request failed, skipping this source for this run: ${message}`);
        } else {
          result.errors.push(`第 ${page} 頁擷取失敗: ${message}`);
          console.error(`[racesSync] loing-ma.com page ${page} fetch failed`, error);
        }
        break;
      }

      if (topics.length === 0) break;

      let newOnThisPage = 0;
      const now = new Date();
      for (const topic of topics) {
        const raceDate = extractRaceDate(topic.title, topic.postedAt);
        const status = deriveLoingMaStatus(raceDate, now);
        const content = sanitizeDescriptionHtml(`<p>${escapeHtml(topic.contentText)}</p>`);

        const outcome = await upsertRace({
          source: "loing_ma",
          status,
          title: topic.title.slice(0, 255),
          originalTitle: null,
          content,
          originalContent: null,
          raceDate,
          imageFileName: null,
          sourceUrl: topic.sourceUrl,
        });

        if (!outcome.ok) {
          result.errors.push(`寫入資料庫失敗 (${topic.sourceUrl}): ${outcome.error}`);
          continue;
        }
        if (outcome.inserted) {
          result.imported++;
          newOnThisPage++;
        } else {
          result.updated++;
        }
      }

      // A full page with nothing newly-inserted means this run has caught up
      // to an earlier run's history — same early-stop convention as
      // lib/newsSync.ts (topics are listed newest-first).
      if (page > 1 && newOnThisPage === 0) break;
      if (topics.length < LOING_MA_TOPICS_PER_PAGE) break;
    }
  } finally {
    await client.close();
  }

  return result;
}

// Translates one plain-text line, falling back to the original (HTML-escaped)
// English text when translation fails — same "never drop the content, just
// degrade" convention as lib/newsSync.ts's translateOrFallback. herbots.be
// races have no long-form article body; this module instead composes a short
// structured summary (level/category/basketing/release/winner) and
// translates it line by line.
async function translateOrFallback(plainText: string, result: HerbotsSyncResult): Promise<string> {
  if (!plainText.trim()) return "";
  const translated = await translateToTraditionalChinese(plainText);
  if (translated.ok && translated.text.trim()) {
    return escapeHtml(translated.text.trim());
  }
  result.translationFailures++;
  return escapeHtml(plainText);
}

function formatUtcDateTime(unixSeconds: number): string {
  return `${new Date(unixSeconds * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function buildSummaryLines(summary: HerbotsRaceSummary): string[] {
  const lines = [
    `Level: ${summary.level}`,
    `Category: ${summary.category}`,
    `Basketing: ${formatUtcDateTime(summary.basketingTime)}`,
    `Release: ${formatUtcDateTime(summary.releaseTime)}`,
  ];
  if (summary.winner) lines.push(`Winner: ${summary.winner}`);
  return lines;
}

async function importOneHerbotsRace(
  client: HerbotsRacesClient,
  summary: HerbotsRaceSummary,
  result: HerbotsSyncResult,
): Promise<boolean> {
  const originalTitle = `${summary.place} (${summary.category})`.slice(0, 255);
  const lines = buildSummaryLines(summary);
  const originalContent = sanitizeDescriptionHtml(lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(""));

  const translatedTitle = (await translateOrFallback(originalTitle, result)).slice(0, 255);
  const translatedLines: string[] = [];
  for (const line of lines) {
    translatedLines.push(await translateOrFallback(line, result));
  }
  const content = sanitizeDescriptionHtml(translatedLines.map((line) => `<p>${line}</p>`).join(""));

  let imageFileName: string | null = null;
  if (summary.image) {
    const image = await client.fetchImageBuffer(summary.image);
    if (image) {
      imageFileName = await saveRaceImageFromBuffer(image.buffer, image.contentType);
    }
  }

  const outcome = await upsertRace({
    source: "herbots",
    status: summary.status,
    title: translatedTitle,
    originalTitle,
    content,
    originalContent,
    raceDate: new Date(summary.releaseTime * 1000),
    imageFileName,
    sourceUrl: summary.sourceUrl,
  });

  if (!outcome.ok) {
    result.errors.push(`寫入資料庫失敗 (${summary.sourceUrl}): ${outcome.error}`);
    return false;
  }
  if (outcome.inserted) {
    result.imported++;
  } else {
    result.updated++;
  }
  return outcome.inserted;
}

async function syncHerbotsRaces(): Promise<HerbotsSyncResult> {
  const result = emptyHerbotsResult();

  if (!isTranslationConfigured()) {
    console.error(
      "[racesSync] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_API_TOKEN 未設定，本次同步的 herbots.be 賽事將以原文（未翻譯）儲存",
    );
  }

  const client = new HerbotsRacesClient();
  try {
    try {
      await client.open();
    } catch (error) {
      result.errors.push("無法啟動 Playwright headless browser，herbots.be 賽事同步已中止");
      console.error("[racesSync] herbots.be chromium launch failed", error);
      return result;
    }

    for (const status of HERBOTS_STATUSES) {
      for (let page = 1; page <= MAX_PAGES; page++) {
        let summaries: HerbotsRaceSummary[];
        try {
          summaries = await client.fetchSummaries(status, page, HERBOTS_RACES_PER_PAGE);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // Per-status-bucket resilience (see lib/herbotsRaces.ts's header
          // comment re: type=future currently 404ing) — log and move on to
          // the next status rather than aborting the whole herbots.be half.
          result.errors.push(`herbots.be ${status} 賽事第 ${page} 頁擷取失敗: ${message}`);
          console.error(`[racesSync] herbots.be races (${status}) page ${page} fetch failed`, error);
          break;
        }

        if (summaries.length === 0) break;

        let newOnThisPage = 0;
        for (const summary of summaries) {
          try {
            if (await importOneHerbotsRace(client, summary, result)) newOnThisPage++;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            result.errors.push(`匯入失敗 (${summary.sourceUrl}): ${message}`);
            console.error(`[racesSync] herbots.be race import failed for ${summary.sourceUrl}`, error);
          }
        }

        if (page > 1 && newOnThisPage === 0) break;
        if (summaries.length < HERBOTS_RACES_PER_PAGE) break;
      }
    }
  } finally {
    await client.close();
  }

  return result;
}

// Entry point — called by lib/scheduler.ts's daily tick. Runs both sources
// sequentially (not in parallel) so a single shared error-handling narrative
// is easy to read in server logs; there is no shared resource forcing
// sequential execution, but the two sources' total network cost is modest
// enough that the simplicity is worth it.
export async function syncRaces(): Promise<RacesSyncResult> {
  const loingMa = await syncLoingMaRaces();
  const herbots = await syncHerbotsRaces();
  return { loingMa, herbots };
}
