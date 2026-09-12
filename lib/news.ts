// CRUD for `news_posts` (see db/init.sql / lib/db.ts's SCHEMA_SQL) — public
// "最新訊息" announcements (issue #56). Hand-written SQL via mysql2, same
// style as lib/pigeonShowcase.ts / lib/listings.ts (this project has no
// ORM). broadcastId (issue #80) links a row to the Resend broadcast sent for
// it — see lib/newsletter.ts, which owns everything about what that id's
// current status/schedule actually is; this module only stores/clears the
// pointer.

import { getDb } from "@/lib/db";
import { paginate } from "@/lib/pagination";

/** 'manual' — hand-authored via app/z04urru6/news/; 'herbots' — imported by lib/newsSync.ts (issue #240). */
export type NewsPostSource = "manual" | "herbots";

export interface NewsPost {
  id: number;
  /** Traditional Chinese — hand-typed for 'manual' rows, Cloudflare-Workers-AI-translated for 'herbots' rows. */
  title: string;
  /** Sanitized HTML (see lib/sanitizeDescriptionHtml.ts) — sanitizing is the caller's (API route's / lib/newsSync.ts's) responsibility, not this module's. */
  content: string;
  /** 主圖 file name under uploads/news/ (see lib/uploads.ts); NULL only on rows created before issue #70 — every create/edit after #70 requires one. */
  imageFileName: string | null;
  /** Resend broadcast id (issue #80) — NULL until an admin opts in to send a newsletter for this post. See lib/newsletter.ts for what its live status/schedule actually is. */
  broadcastId: string | null;
  /** issue #240 — see db/init.sql's news_posts comment for the full source-tracking story. */
  source: NewsPostSource;
  /** herbots.be article URL (de-dup key); NULL on 'manual' rows. */
  sourceUrl: string | null;
  /** Pre-translation title; NULL on 'manual' rows. Rendered alongside `title` on the detail page. */
  originalTitle: string | null;
  /** Pre-translation, sanitized content; NULL on 'manual' rows. */
  originalContent: string | null;
  /** Original herbots.be publish date; NULL on 'manual' rows (which sort by createdAt instead — see listNews). */
  publishedAt: Date | null;
  /** Set once an admin saves an edit via app/z04urru6/news/ — lib/newsSync.ts then never overwrites this row again. */
  lockedByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsPostInput {
  title: string;
  content: string;
  /** Required — the admin form/API route enforce an upload on every create/edit (issue #70). */
  imageFileName: string;
}

// Fields lib/newsSync.ts supplies when importing a herbots.be article —
// distinct from NewsPostInput (the admin form's shape) since imported rows
// carry the extra source-tracking columns and never go through the admin
// form's "must re-upload every edit" image rule.
export interface ImportedNewsPostInput {
  /** Traditional Chinese translation (or the original English text as a fallback when translation is unavailable — see lib/newsSync.ts). */
  title: string;
  /** Sanitized HTML, already translated (or original-language fallback). */
  content: string;
  /** Local uploads/news/ file name, or null when the source article had no cover image or the download failed. */
  imageFileName: string | null;
  sourceUrl: string;
  originalTitle: string;
  /** Sanitized HTML, pre-translation. */
  originalContent: string;
  publishedAt: Date;
}

export type NewsPostOutcome = { ok: true } | { ok: false; error: string };

export const NEWS_PAGE_SIZES = [30, 50, 100] as const;
export type NewsPageSize = (typeof NEWS_PAGE_SIZES)[number];
export const DEFAULT_NEWS_PAGE_SIZE: NewsPageSize = 30;

export function isNewsPageSize(value: number): value is NewsPageSize {
  return (NEWS_PAGE_SIZES as readonly number[]).includes(value);
}

export interface ListNewsOptions {
  /** Case-insensitive substring match against title — used by both the admin list and the public /news search box. */
  search?: string;
  page?: number;
  pageSize?: NewsPageSize;
}

interface NewsPostRow {
  id: number;
  title: string;
  content: string;
  image_file_name: string | null;
  broadcast_id: string | null;
  source: NewsPostSource;
  source_url: string | null;
  original_title: string | null;
  original_content: string | null;
  published_at: Date | null;
  locked_by_admin: number;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: NewsPostRow): NewsPost {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    imageFileName: row.image_file_name,
    broadcastId: row.broadcast_id,
    source: row.source,
    sourceUrl: row.source_url,
    originalTitle: row.original_title,
    originalContent: row.original_content,
    publishedAt: row.published_at,
    lockedByAdmin: Boolean(row.locked_by_admin),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, title, content, image_file_name, broadcast_id, source, source_url, original_title, original_content, published_at, locked_by_admin, created_at, updated_at FROM news_posts`;

// "最新" ordering everywhere in this module means the article's own
// published date, not necessarily when this row was written: a 'manual'
// row's published_at is always NULL (COALESCE falls back to created_at, its
// original and only meaningful date), while a 'herbots' row's published_at
// is the source article's real herbots.be publish date — using it instead of
// created_at (this row's *import* time) is what keeps the /news list and
// homepage carousel in true chronological order regardless of which day the
// daily sync happened to pick an older backlog article up on (issue #240).
const ORDER_BY_LATEST = "ORDER BY COALESCE(published_at, created_at) DESC, id DESC";

// Powers the admin list (title search + pagination) and the public /news
// list page (same filters, minus admin-only concerns) — manual and
// herbots.be-imported rows are listed together, unsorted by source, with no
// cap (issue #240: the 10-item cap only applies to the homepage carousel,
// see listHomepageNewsCarousel below).
export async function listNews(options: ListNewsOptions = {}): Promise<{ items: NewsPost[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  const search = options.search?.trim();
  if (search) {
    conditions.push("title LIKE ?");
    params.push(`%${search}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM news_posts ${where}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const { offset, limit } = paginate(options.page, options.pageSize ?? DEFAULT_NEWS_PAGE_SIZE);

  const [rows] = await db.query(
    `${SELECT} ${where} ${ORDER_BY_LATEST} LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: (rows as NewsPostRow[]).map(mapRow), total };
}

// Detail-page sidebar helper — same newest-first ordering as listNews, just
// without the pagination/search UI that caller doesn't need. (The homepage
// carousel uses listHomepageNewsCarousel below instead, not this.)
export async function listLatestNews(limit: number): Promise<NewsPost[]> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT} ${ORDER_BY_LATEST} LIMIT ?`, [limit]);
  return (rows as NewsPostRow[]).map(mapRow);
}

// Homepage "最新新聞" carousel (issue #240) — the ONLY place the 10-item cap
// applies (/news itself is uncapped, see listNews above). Manual posts are
// prioritized outright (every one of them, newest-first, up to `limit`) and
// herbots.be imports only fill whatever slots are left, newest-first — so a
// backlog of imported articles can never push a hand-written announcement
// out of the carousel, but also never appears at all once there are already
// `limit` manual posts.
export async function listHomepageNewsCarousel(limit: number): Promise<NewsPost[]> {
  const db = await getDb();
  const [manualRows] = await db.query(
    `${SELECT} WHERE source = 'manual' ${ORDER_BY_LATEST} LIMIT ?`,
    [limit],
  );
  const manual = (manualRows as NewsPostRow[]).map(mapRow);
  if (manual.length >= limit) return manual;

  const [importedRows] = await db.query(
    `${SELECT} WHERE source = 'herbots' ${ORDER_BY_LATEST} LIMIT ?`,
    [limit - manual.length],
  );
  return [...manual, ...(importedRows as NewsPostRow[]).map(mapRow)];
}

export async function getNewsById(id: number): Promise<NewsPost | null> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT} WHERE id = ? LIMIT 1`, [id]);
  const row = (rows as NewsPostRow[])[0];
  return row ? mapRow(row) : null;
}

export async function createNews(input: NewsPostInput): Promise<NewsPostOutcome & { id?: number }> {
  const db = await getDb();
  const [result] = await db.query(
    `INSERT INTO news_posts (title, image_file_name, content, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
    [input.title, input.imageFileName, input.content],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

// Always sets locked_by_admin = 1 (issue #240): this is the only write path
// behind the admin edit form (app/api/admin/news/[id]/route.ts), so any call
// here IS an admin's manual edit — including of a 'herbots'-imported row —
// and lib/newsSync.ts must never again overwrite whatever the admin just
// saved. A no-op on already-locked/'manual' rows.
export async function updateNews(id: number, input: NewsPostInput): Promise<NewsPostOutcome> {
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE news_posts SET title = ?, image_file_name = ?, content = ?, locked_by_admin = 1, updated_at = NOW() WHERE id = ?`,
    [input.title, input.imageFileName, input.content, id],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這則訊息" };
  }
  return { ok: true };
}

// Inserts one herbots.be-imported row (issue #240) — lib/newsSync.ts's only
// write path. Deliberately separate from createNews: imported rows always
// carry source='herbots' plus the original-language columns, and (unlike
// the admin form's createNews) are never "locked" at creation time — only a
// later admin edit (updateNews above) sets locked_by_admin, which is what
// tells the next sync run to leave this row alone.
export async function createImportedNews(input: ImportedNewsPostInput): Promise<NewsPostOutcome & { id?: number }> {
  const db = await getDb();
  const [result] = await db.query(
    `INSERT INTO news_posts
       (title, image_file_name, content, source, source_url, original_title, original_content, published_at, created_at, updated_at)
     VALUES (?, ?, ?, 'herbots', ?, ?, ?, ?, NOW(), NOW())`,
    [
      input.title,
      input.imageFileName,
      input.content,
      input.sourceUrl,
      input.originalTitle,
      input.originalContent,
      input.publishedAt,
    ],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

export async function deleteNews(id: number): Promise<NewsPostOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM news_posts WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這則訊息" };
  }
  return { ok: true };
}

// Points/re-points/clears which Resend broadcast (if any) this post's
// newsletter send is tied to (issue #80). Called by the news API routes
// after createBroadcast succeeds (link) or when an admin swaps in a brand
// new broadcast to replace an unsent one (re-point) — never by the news
// content update itself, since a broadcast can outlive several content
// edits (see the "sent" lock rule in NewsFormModal).
export async function setNewsBroadcastId(id: number, broadcastId: string | null): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE news_posts SET broadcast_id = ? WHERE id = ?", [broadcastId, id]);
}

export interface NewsSitemapItem {
  id: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

// Lightweight query for sitemap generation (issue #191) — fetches all news
// posts with only the fields needed for sitemap.xml and news-sitemap.xml.
export async function listNewsForSitemap(): Promise<NewsSitemapItem[]> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT id, title, created_at, updated_at FROM news_posts ORDER BY created_at DESC, id DESC",
  );
  return (rows as { id: number; title: string; created_at: Date; updated_at: Date }[]).map((r) => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

