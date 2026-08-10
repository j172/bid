// CRUD for `news_posts` (see db/init.sql / lib/db.ts's SCHEMA_SQL) — public
// "最新訊息" announcements (issue #56). Hand-written SQL via mysql2, same
// style as lib/pigeonShowcase.ts / lib/listings.ts (this project has no
// ORM). broadcastId (issue #80) links a row to the Resend broadcast sent for
// it — see lib/newsletter.ts, which owns everything about what that id's
// current status/schedule actually is; this module only stores/clears the
// pointer.

import { getDb } from "@/lib/db";
import { paginate } from "@/lib/pagination";

export interface NewsPost {
  id: number;
  title: string;
  /** Sanitized HTML (see lib/sanitizeDescriptionHtml.ts) — sanitizing is the caller's (API route's) responsibility, not this module's. */
  content: string;
  /** 主圖 file name under uploads/news/ (see lib/uploads.ts); NULL only on rows created before issue #70 — every create/edit after #70 requires one. */
  imageFileName: string | null;
  /** Resend broadcast id (issue #80) — NULL until an admin opts in to send a newsletter for this post. See lib/newsletter.ts for what its live status/schedule actually is. */
  broadcastId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewsPostInput {
  title: string;
  content: string;
  /** Required — the admin form/API route enforce an upload on every create/edit (issue #70). */
  imageFileName: string;
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, title, content, image_file_name, broadcast_id, created_at, updated_at FROM news_posts`;

// Powers the admin list (title search + pagination) and the public /news
// list page (same filters, minus admin-only concerns). Always newest-first
// so every caller gets consistent "最新" ordering without re-sorting
// client-side.
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
    `${SELECT} ${where} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: (rows as NewsPostRow[]).map(mapRow), total };
}

// Homepage carousel / detail-page sidebar helper — same newest-first
// ordering as listNews, just without the pagination/search UI those callers
// don't need.
export async function listLatestNews(limit: number): Promise<NewsPost[]> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT} ORDER BY created_at DESC, id DESC LIMIT ?`, [limit]);
  return (rows as NewsPostRow[]).map(mapRow);
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

export async function updateNews(id: number, input: NewsPostInput): Promise<NewsPostOutcome> {
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE news_posts SET title = ?, image_file_name = ?, content = ?, updated_at = NOW() WHERE id = ?`,
    [input.title, input.imageFileName, input.content, id],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這則訊息" };
  }
  return { ok: true };
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
