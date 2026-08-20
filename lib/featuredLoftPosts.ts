// CRUD for `featured_loft_posts` (see db/init.sql / lib/db.ts's SCHEMA_SQL) —
// 名家專區 article-style content (issue #176), replacing issue #168's
// lightweight homepage_sections('featured_loft') cards with its own
// independent table: full rich-text content + its own detail page, same
// shape as 最新訊息 (lib/news.ts). Hand-written SQL via mysql2, same style as
// lib/news.ts / lib/pigeonShowcase.ts (this project has no ORM).
//
// loft_id is an OPTIONAL pointer at homepage_sections(id) — the exact same
// "FK to homepage_sections but only rows where section_type='partner_loft'"
// shape as pigeon_showcase.loft_id, so isPartnerLoft() below mirrors
// lib/pigeonShowcase.ts's application-level check verbatim (MySQL can't
// scope a FK to only matching rows, so this is enforced here on write
// instead). Unlike pigeon_showcase, this column is nullable: a post with no
// loft_id simply omits the "查看商品" button on its detail page (see
// app/[locale]/(no-loading)/featured-lofts/[id]/page.tsx) rather than
// requiring one.
//
// Deliberately no broadcast_id / newsletter fields — unlike news_posts, this
// feature never sends a newsletter (issue #176 explicit non-goal).

import { getDb } from "@/lib/db";
import { paginate } from "@/lib/pagination";

export interface FeaturedLoftPost {
  id: number;
  title: string;
  /** Sanitized HTML (see lib/sanitizeDescriptionHtml.ts) — sanitizing is the caller's (API route's) responsibility, not this module's. */
  content: string;
  /** 主圖 file name under uploads/featured-loft-posts/ (see lib/uploads.ts). */
  imageFileName: string | null;
  /** Optional homepage_sections(id) this post is about — null when the post has no linked 合作鴿舍. */
  loftId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeaturedLoftPostInput {
  title: string;
  content: string;
  /** Required — every create/edit enforces an upload, same convention as news_posts/pigeon_showcase post-issue-#70. */
  imageFileName: string;
  /** Null means "no loft link" — validated against homepage_sections(section_type='partner_loft') by isPartnerLoft() when set. */
  loftId: number | null;
}

export type FeaturedLoftPostOutcome = { ok: true } | { ok: false; error: string };

export const FEATURED_LOFT_POST_PAGE_SIZES = [30, 50, 100] as const;
export type FeaturedLoftPostPageSize = (typeof FEATURED_LOFT_POST_PAGE_SIZES)[number];
export const DEFAULT_FEATURED_LOFT_POST_PAGE_SIZE: FeaturedLoftPostPageSize = 30;

export function isFeaturedLoftPostPageSize(value: number): value is FeaturedLoftPostPageSize {
  return (FEATURED_LOFT_POST_PAGE_SIZES as readonly number[]).includes(value);
}

export interface ListFeaturedLoftPostsOptions {
  /** Case-insensitive substring match against title — used by both the admin list and the public /featured-lofts search box. */
  search?: string;
  page?: number;
  pageSize?: FeaturedLoftPostPageSize;
}

interface FeaturedLoftPostRow {
  id: number;
  title: string;
  content: string;
  image_file_name: string | null;
  loft_id: number | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: FeaturedLoftPostRow): FeaturedLoftPost {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    imageFileName: row.image_file_name,
    loftId: row.loft_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, title, content, image_file_name, loft_id, created_at, updated_at FROM featured_loft_posts`;

// Powers the admin list (title search + pagination) and the public
// /featured-lofts list page (same filters, minus admin-only concerns).
// Always newest-first so every caller gets consistent "最新" ordering
// without re-sorting client-side.
export async function listFeaturedLoftPosts(
  options: ListFeaturedLoftPostsOptions = {},
): Promise<{ items: FeaturedLoftPost[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  const search = options.search?.trim();
  if (search) {
    conditions.push("title LIKE ?");
    params.push(`%${search}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM featured_loft_posts ${where}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const { offset, limit } = paginate(options.page, options.pageSize ?? DEFAULT_FEATURED_LOFT_POST_PAGE_SIZE);

  const [rows] = await db.query(
    `${SELECT} ${where} ORDER BY created_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: (rows as FeaturedLoftPostRow[]).map(mapRow), total };
}

// Homepage carousel / detail-page sidebar / /listings grid helper — same
// newest-first ordering as listFeaturedLoftPosts, just without the
// pagination/search UI those callers don't need.
export async function listLatestFeaturedLoftPosts(limit: number): Promise<FeaturedLoftPost[]> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT} ORDER BY created_at DESC, id DESC LIMIT ?`, [limit]);
  return (rows as FeaturedLoftPostRow[]).map(mapRow);
}

export async function getFeaturedLoftPostById(id: number): Promise<FeaturedLoftPost | null> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT} WHERE id = ? LIMIT 1`, [id]);
  const row = (rows as FeaturedLoftPostRow[])[0];
  return row ? mapRow(row) : null;
}

// Confirms loftId refers to a homepage_sections row whose section_type is
// 'partner_loft' — the part of "FK -> homepage_sections(id) WHERE
// section_type='partner_loft'" that a real MySQL FK constraint can't express
// on its own (see this file's header comment, and lib/pigeonShowcase.ts's
// identical isPartnerLoft(), which this mirrors). Only called when loftId is
// non-null — create/updateFeaturedLoftPost skip it entirely for null.
async function isPartnerLoft(loftId: number): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query("SELECT 1 FROM homepage_sections WHERE id = ? AND section_type = 'partner_loft' LIMIT 1", [
    loftId,
  ]);
  return (rows as unknown[]).length > 0;
}

export async function createFeaturedLoftPost(input: FeaturedLoftPostInput): Promise<FeaturedLoftPostOutcome & { id?: number }> {
  if (input.loftId !== null && !(await isPartnerLoft(input.loftId))) {
    return { ok: false, error: "找不到這個合作鴿舍" };
  }
  const db = await getDb();
  const [result] = await db.query(
    `INSERT INTO featured_loft_posts (title, image_file_name, content, loft_id, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [input.title, input.imageFileName, input.content, input.loftId],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

export async function updateFeaturedLoftPost(id: number, input: FeaturedLoftPostInput): Promise<FeaturedLoftPostOutcome> {
  if (input.loftId !== null && !(await isPartnerLoft(input.loftId))) {
    return { ok: false, error: "找不到這個合作鴿舍" };
  }
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE featured_loft_posts SET title = ?, image_file_name = ?, content = ?, loft_id = ?, updated_at = NOW() WHERE id = ?`,
    [input.title, input.imageFileName, input.content, input.loftId, id],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這篇名家專區文章" };
  }
  return { ok: true };
}

export async function deleteFeaturedLoftPost(id: number): Promise<FeaturedLoftPostOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM featured_loft_posts WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這篇名家專區文章" };
  }
  return { ok: true };
}
