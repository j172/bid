// CRUD for `pigeon_showcase` (see db/init.sql / lib/db.ts's SCHEMA_SQL) —
// 入賞鴿／進口鴿 showcase entries (issue #54). Hand-written SQL via mysql2,
// same style as lib/listings.ts / lib/homepageSections.ts (this project has
// no ORM). Deliberately NOT a revival of the pigeon_gallery_* modules
// removed by issue #52 — see db/init.sql's comment on the table itself.
//
// loft_id is a real DB-level FK to homepage_sections(id) (ON DELETE/UPDATE
// RESTRICT — see the schema comment), but MySQL can't scope a FK to only
// rows matching section_type = 'partner_loft', so createPigeonShowcase/
// updatePigeonShowcase re-check that condition here at the application
// layer before writing.

import { getDb } from "@/lib/db";
import { paginate } from "@/lib/pagination";
import type { PigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";

export type { PigeonShowcaseCategory };

export interface PigeonShowcase {
  id: number;
  category: PigeonShowcaseCategory;
  name: string;
  loftId: number;
  loftTitle: string;
  /** Sanitized HTML (see lib/sanitizeDescriptionHtml.ts) — sanitizing is the caller's (API route's) responsibility, not this module's. */
  description: string;
  /** 主圖 file name under uploads/pigeon-showcase/ (see lib/uploads.ts); NULL only on rows created before issue #70 — every create/edit after #70 requires one. */
  imageFileName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PigeonShowcaseInput {
  category: PigeonShowcaseCategory;
  name: string;
  loftId: number;
  description: string;
  /** Required — the admin form/API route enforce an upload on every create/edit (issue #70). */
  imageFileName: string;
}

export type PigeonShowcaseOutcome = { ok: true } | { ok: false; error: string };

export const PIGEON_SHOWCASE_PAGE_SIZES = [30, 50, 100] as const;
export type PigeonShowcasePageSize = (typeof PIGEON_SHOWCASE_PAGE_SIZES)[number];
export const DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE: PigeonShowcasePageSize = 30;

export function isPigeonShowcasePageSize(value: number): value is PigeonShowcasePageSize {
  return (PIGEON_SHOWCASE_PAGE_SIZES as readonly number[]).includes(value);
}

export interface ListPigeonShowcaseOptions {
  category?: PigeonShowcaseCategory;
  /** Case-insensitive substring match against name (admin only — the public list/homepage never search by name). */
  search?: string;
  loftId?: number;
  page?: number;
  pageSize?: PigeonShowcasePageSize;
}

interface PigeonShowcaseRow {
  id: number;
  category: PigeonShowcaseCategory;
  name: string;
  loft_id: number;
  loft_title: string;
  description: string;
  image_file_name: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: PigeonShowcaseRow): PigeonShowcase {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    loftId: row.loft_id,
    loftTitle: row.loft_title,
    description: row.description,
    imageFileName: row.image_file_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_WITH_LOFT = `
  SELECT ps.id, ps.category, ps.name, ps.loft_id, hs.title AS loft_title, ps.description, ps.image_file_name, ps.created_at, ps.updated_at
  FROM pigeon_showcase ps
  JOIN homepage_sections hs ON hs.id = ps.loft_id
`;

// Powers the admin list (all filters available), the public category list
// page (category + pagination only), and — via a small pageSize of its own —
// the homepage carousel's "latest 10" fetch. Always newest-first so every
// caller gets consistent "最新" ordering without re-sorting client-side.
export async function listPigeonShowcase(
  options: ListPigeonShowcaseOptions = {},
): Promise<{ items: PigeonShowcase[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.category) {
    conditions.push("ps.category = ?");
    params.push(options.category);
  }
  const search = options.search?.trim();
  if (search) {
    conditions.push("ps.name LIKE ?");
    params.push(`%${search}%`);
  }
  if (options.loftId !== undefined) {
    conditions.push("ps.loft_id = ?");
    params.push(options.loftId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM pigeon_showcase ps ${where}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const { offset, limit } = paginate(options.page, options.pageSize ?? DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE);

  const [rows] = await db.query(
    `${SELECT_WITH_LOFT} ${where} ORDER BY ps.created_at DESC, ps.id DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: (rows as PigeonShowcaseRow[]).map(mapRow), total };
}

// Homepage carousel / detail-page sidebar helper — same newest-first
// ordering as listPigeonShowcase, just without the pagination/filter UI
// those callers don't need. `limit` isn't restricted to
// PIGEON_SHOWCASE_PAGE_SIZES since "latest 10" (issue #54's homepage spec)
// isn't one of the admin/list page's selectable page sizes.
export async function listLatestPigeonShowcase(category: PigeonShowcaseCategory, limit: number): Promise<PigeonShowcase[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `${SELECT_WITH_LOFT} WHERE ps.category = ? ORDER BY ps.created_at DESC, ps.id DESC LIMIT ?`,
    [category, limit],
  );
  return (rows as PigeonShowcaseRow[]).map(mapRow);
}

export async function getPigeonShowcaseById(id: number): Promise<PigeonShowcase | null> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT_WITH_LOFT} WHERE ps.id = ? LIMIT 1`, [id]);
  const row = (rows as PigeonShowcaseRow[])[0];
  return row ? mapRow(row) : null;
}

// Confirms loftId refers to a homepage_sections row whose section_type is
// 'partner_loft' — the part of "FK -> homepage_sections(id) WHERE
// section_type='partner_loft'" that a real MySQL FK constraint can't express
// on its own (see this file's header comment).
async function isPartnerLoft(loftId: number): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query("SELECT 1 FROM homepage_sections WHERE id = ? AND section_type = 'partner_loft' LIMIT 1", [
    loftId,
  ]);
  return (rows as unknown[]).length > 0;
}

export async function createPigeonShowcase(input: PigeonShowcaseInput): Promise<PigeonShowcaseOutcome & { id?: number }> {
  if (!(await isPartnerLoft(input.loftId))) {
    return { ok: false, error: "找不到這個合作鴿舍" };
  }
  const db = await getDb();
  const [result] = await db.query(
    `INSERT INTO pigeon_showcase (category, name, loft_id, image_file_name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [input.category, input.name, input.loftId, input.imageFileName, input.description],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

export async function updatePigeonShowcase(id: number, input: PigeonShowcaseInput): Promise<PigeonShowcaseOutcome> {
  if (!(await isPartnerLoft(input.loftId))) {
    return { ok: false, error: "找不到這個合作鴿舍" };
  }
  const db = await getDb();
  const [result] = await db.query(
    `UPDATE pigeon_showcase SET category = ?, name = ?, loft_id = ?, image_file_name = ?, description = ?, updated_at = NOW() WHERE id = ?`,
    [input.category, input.name, input.loftId, input.imageFileName, input.description, id],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這筆鴿況資料" };
  }
  return { ok: true };
}

export async function deletePigeonShowcase(id: number): Promise<PigeonShowcaseOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM pigeon_showcase WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這筆鴿況資料" };
  }
  return { ok: true };
}
