// Daily herbots.be → news_posts sync (issue #240). Orchestrates
// lib/herbotsNews.ts (scrape), lib/translate.ts (Cloudflare Workers AI),
// lib/newsImportLog.ts (de-dup) and lib/news.ts (write) — see
// lib/scheduler.ts for when this actually runs.
//
// Whole-run error handling follows lib/exchangeRates.ts's convention: this
// function itself never throws for a "normal" failure (a page fetch error, a
// single article's translation failing, Cloudflare AI not being configured
// at all) — every failure is caught, logged, and folded into the returned
// NewsSyncResult so one bad article can't take the rest of the run down with
// it, and the scheduler's own .catch() is reserved for truly unexpected bugs.
import { HerbotsNewsClient, HERBOTS_PER_PAGE, type HerbotsArticleSummary } from "@/lib/herbotsNews";
import { hasImportedSourceUrl, recordImportedSourceUrl } from "@/lib/newsImportLog";
import { createImportedNews, type ImportedNewsPostInput } from "@/lib/news";
import { isTranslationConfigured, translateToTraditionalChinese } from "@/lib/translate";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { saveNewsImageFromBuffer } from "@/lib/uploads";
import { escapeHtml, htmlToPlainText } from "@/lib/htmlText";
import { plainTextLength } from "@/lib/richTextValidation";
import { CONTENT_MAX, TITLE_MAX } from "@/lib/newsValidation";

// Bounds one sync run's worst case (a fresh install with an empty
// news_import_log, or herbots.be publishing an unusually large batch in one
// day) to MAX_PAGES * HERBOTS_PER_PAGE ≈ 75 candidate articles. In the
// ordinary case — a handful of new articles since yesterday's run — the
// early-stop rule below (a full page with zero *new* articles) exits after
// page 1.
const MAX_PAGES = 3;

export interface NewsSyncResult {
  /** Articles newly written to news_posts this run. */
  imported: number;
  /** Already in news_import_log — normal steady-state outcome, not an error. */
  skippedExisting: number;
  /** Fetched but had no usable article body (e.g. an in-memoriam notice with no English text). */
  skippedNoContent: number;
  /** Count of translateToTraditionalChinese calls that failed (missing credentials, API error, etc.) — the affected article/field still gets imported using its original-language text as a fallback (see translateOrFallback below). */
  translationFailures: number;
  /** Human-readable per-article/per-page failures, for server logs / the manual-sync admin panel. */
  errors: string[];
}

function emptyResult(): NewsSyncResult {
  return { imported: 0, skippedExisting: 0, skippedNoContent: 0, translationFailures: 0, errors: [] };
}

// Translates one plain-text chunk, falling back to the original text
// (HTML-escaped, since it's about to be embedded back into HTML) when
// translation fails for any reason — issue #240 requires the whole sync job
// to keep running even with no Cloudflare Workers AI credentials configured,
// and an imported-but-untranslated article is more useful to an admin than
// a silently dropped one. `result.translationFailures` is incremented so the
// caller's summary/log line makes the degradation visible.
async function translateOrFallback(plainText: string, result: NewsSyncResult): Promise<string> {
  if (!plainText.trim()) return "";
  const translated = await translateToTraditionalChinese(plainText);
  if (translated.ok && translated.text.trim()) {
    return escapeHtml(translated.text.trim());
  }
  result.translationFailures++;
  return escapeHtml(plainText);
}

// Translates a sanitized HTML article body one <p> block at a time (Workers
// AI's translation model operates on plain text, not markup) and re-wraps
// each translated block in its own <p> — losing inline formatting
// (bold/links) within a paragraph is an accepted simplification; the
// original, fully-formatted HTML is preserved untouched in
// news_posts.original_content regardless.
async function translateHtmlBody(sanitizedHtml: string, result: NewsSyncResult): Promise<string> {
  const blocks = sanitizedHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
  if (!blocks || blocks.length === 0) {
    const plain = htmlToPlainText(sanitizedHtml);
    if (!plain) return "";
    return `<p>${await translateOrFallback(plain, result)}</p>`;
  }

  const translatedBlocks: string[] = [];
  for (const block of blocks) {
    const plain = htmlToPlainText(block);
    if (!plain) continue;
    translatedBlocks.push(`<p>${await translateOrFallback(plain, result)}</p>`);
  }
  return translatedBlocks.join("");
}

// Cuts a sanitized HTML string down to at most maxPlainChars of visible text
// without splitting a <p> block mid-sentence, dropping whole trailing
// paragraphs first and only hard-truncating text when a single paragraph
// alone already exceeds the cap. Mirrors news_posts.content's existing
// "sanitizeDescriptionHtml'd, 2000-char plain-text cap" convention
// (lib/newsValidation.ts's CONTENT_MAX) — this sync job writes directly via
// lib/news.ts rather than through the admin API route's validateNewsContent,
// so it has to enforce that cap itself.
function truncateHtmlToPlainLength(html: string, maxPlainChars: number): string {
  if (plainTextLength(html) <= maxPlainChars) return html;

  const blocks = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) ?? [html];
  let accumulated = "";
  for (const block of blocks) {
    const candidate = accumulated + block;
    if (plainTextLength(candidate) > maxPlainChars) {
      if (accumulated) return accumulated;
      const text = htmlToPlainText(block);
      return `<p>${escapeHtml(text.slice(0, maxPlainChars))}…</p>`;
    }
    accumulated = candidate;
  }
  return accumulated;
}

function truncateTitle(title: string): string {
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;
}

async function importOneArticle(
  client: HerbotsNewsClient,
  summary: HerbotsArticleSummary,
  result: NewsSyncResult,
): Promise<void> {
  const rawContentHtml = await client.fetchContentHtml(summary.id);
  if (!rawContentHtml.trim()) {
    result.skippedNoContent++;
    return;
  }

  const originalTitle = summary.title.trim().slice(0, 255);
  const originalContent = sanitizeDescriptionHtml(rawContentHtml);

  const translatedTitleRaw = await translateOrFallback(originalTitle, result);
  const translatedContentRaw = await translateHtmlBody(originalContent, result);

  const title = truncateTitle(translatedTitleRaw);
  const content = truncateHtmlToPlainLength(sanitizeDescriptionHtml(translatedContentRaw), CONTENT_MAX);

  let imageFileName: string | null = null;
  if (summary.mainImage) {
    const image = await client.fetchImageBuffer(summary.mainImage);
    if (image) {
      imageFileName = await saveNewsImageFromBuffer(image.buffer, image.contentType);
    }
  }

  const input: ImportedNewsPostInput = {
    title,
    content,
    imageFileName,
    sourceUrl: summary.sourceUrl,
    originalTitle,
    originalContent,
    publishedAt: new Date(summary.publishOn * 1000),
  };

  const inserted = await createImportedNews(input);
  if (!inserted.ok || inserted.id === undefined) {
    result.errors.push(`寫入資料庫失敗 (${summary.sourceUrl})`);
    return;
  }

  await recordImportedSourceUrl("herbots", summary.sourceUrl, inserted.id);
  result.imported++;
}

// Entry point — called by lib/scheduler.ts's daily tick and by the admin
// manual-sync button (app/api/admin/news/sync/route.ts). Safe to call
// without CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_AI_API_TOKEN configured: articles
// still import, just untranslated (title/content fall back to the original
// English text) — see translateOrFallback above. That absence is logged once
// up front here so it's unmistakable in server logs *why* a run came back
// with translationFailures > 0, rather than requiring an admin to infer it
// from many identical per-article log lines.
export async function syncHerbotsNews(): Promise<NewsSyncResult> {
  const result = emptyResult();

  if (!isTranslationConfigured()) {
    console.error(
      "[newsSync] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_API_TOKEN 未設定，本次同步的文章將以原文（未翻譯）儲存",
    );
  }

  // Everything below (including open() itself) is wrapped in one
  // try/finally so a launch failure mid-open() (e.g. chromium.launch()
  // succeeds but newContext() then throws) still closes whatever got
  // started, rather than leaking a headless Chromium process — close() is
  // safe to call even on a client that never fully opened.
  const client = new HerbotsNewsClient();
  try {
    try {
      await client.open();
    } catch (error) {
      result.errors.push("無法啟動 Playwright headless browser，本次同步已中止");
      console.error("[newsSync] chromium launch failed", error);
      return result;
    }

    for (let page = 1; page <= MAX_PAGES; page++) {
      let summaries: HerbotsArticleSummary[];
      try {
        summaries = await client.fetchSummaries(page, HERBOTS_PER_PAGE);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`第 ${page} 頁文章列表擷取失敗: ${message}`);
        console.error(`[newsSync] page ${page} list fetch failed`, error);
        break;
      }

      if (summaries.length === 0) break;

      let newOnThisPage = 0;
      for (const summary of summaries) {
        if (await hasImportedSourceUrl(summary.sourceUrl)) {
          result.skippedExisting++;
          continue;
        }
        newOnThisPage++;
        try {
          await importOneArticle(client, summary, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`匯入失敗 (${summary.sourceUrl}): ${message}`);
          console.error(`[newsSync] import failed for ${summary.sourceUrl}`, error);
        }
      }

      // A full page where every article was already imported means this run
      // has caught up to yesterday's (or an earlier run's) history — no
      // point paying for further page/detail requests today.
      if (page > 1 && newOnThisPage === 0) break;
    }
  } finally {
    await client.close();
  }

  return result;
}
