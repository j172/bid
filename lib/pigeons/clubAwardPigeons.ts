// CRUD for `club_award_albums` and `club_award_pigeons` (issue #378) —
// 各地鴿會入賞鴿專區與相簿分類管理. Completely independent of `pigeon_showcase`.

import { getDb } from "@/lib/shared/data/db";
import { paginate } from "@/lib/shared/data/pagination";
import { isValidClubAwardSortOrder } from "@/lib/pigeons/clubAwardPigeonsValidation";
import type { PigeonShowcaseCategory } from "@/lib/pigeons/pigeonShowcaseValidation";

export type { PigeonShowcaseCategory };

export interface ClubAwardAlbum {
  id: number;
  name: string;
  sortOrder: number;
  pigeonCount: number;
  coverImageFileName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClubAwardPigeon {
  id: number;
  albumId: number;
  sortOrder: number;
  albumTitle: string;
  category: PigeonShowcaseCategory;
  name: string;
  loftId: number | null;
  loftTitle: string | null;
  photoSource: string | null;
  imageFileName: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClubAwardPigeonInput {
  albumId: number;
  sortOrder?: number;
  category: PigeonShowcaseCategory;
  name: string;
  loftId: number | null;
  photoSource?: string | null;
  imageFileName: string;
  description: string;
}

export type ClubAwardOutcome = { ok: true } | { ok: false; error: string };

export const CLUB_AWARD_PAGE_SIZES = [30, 50, 100] as const;
export type ClubAwardPageSize = (typeof CLUB_AWARD_PAGE_SIZES)[number];
export const DEFAULT_CLUB_AWARD_PAGE_SIZE: ClubAwardPageSize = 30;

export function isClubAwardPageSize(value: number): value is ClubAwardPageSize {
  return (CLUB_AWARD_PAGE_SIZES as readonly number[]).includes(value);
}

export interface ListClubAwardAlbumsOptions {
  search?: string;
  page?: number;
  pageSize?: ClubAwardPageSize;
}

export interface ListClubAwardPigeonsOptions {
  albumId?: number;
  category?: PigeonShowcaseCategory;
  search?: string;
  loftId?: number;
  page?: number;
  pageSize?: ClubAwardPageSize;
}

interface ClubAwardAlbumRow {
  id: number;
  name: string;
  sort_order: number;
  pigeon_count: number;
  cover_image_file_name: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ClubAwardPigeonRow {
  id: number;
  album_id: number;
  sort_order: number;
  album_title: string;
  category: PigeonShowcaseCategory;
  name: string;
  loft_id: number | null;
  loft_title: string | null;
  photo_source: string | null;
  image_file_name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
}

function mapAlbumRow(row: ClubAwardAlbumRow): ClubAwardAlbum {
  return {
    id: row.id,
    name: row.name,
    sortOrder: Number(row.sort_order),
    pigeonCount: Number(row.pigeon_count ?? 0),
    coverImageFileName: row.cover_image_file_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPigeonRow(row: ClubAwardPigeonRow): ClubAwardPigeon {
  return {
    id: row.id,
    albumId: row.album_id,
    sortOrder: Number(row.sort_order),
    albumTitle: row.album_title,
    category: row.category,
    name: row.name,
    loftId: row.loft_id,
    loftTitle: row.loft_title ?? null,
    photoSource: row.photo_source ?? null,
    imageFileName: row.image_file_name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_ALBUM_WITH_STATS = `
  SELECT
    caa.id,
    caa.name,
    caa.sort_order,
    (SELECT COUNT(*) FROM club_award_pigeons cap WHERE cap.album_id = caa.id) AS pigeon_count,
    (SELECT cap.image_file_name FROM club_award_pigeons cap WHERE cap.album_id = caa.id ORDER BY cap.sort_order ASC, cap.id ASC LIMIT 1) AS cover_image_file_name,
    caa.created_at,
    caa.updated_at
  FROM club_award_albums caa
`;

const SELECT_PIGEON_WITH_JOINS = `
  SELECT
    cap.id,
    cap.album_id,
    cap.sort_order,
    caa.name AS album_title,
    cap.category,
    cap.name,
    cap.loft_id,
    hs.title AS loft_title,
    cap.photo_source,
    cap.image_file_name,
    cap.description,
    cap.created_at,
    cap.updated_at
  FROM club_award_pigeons cap
  INNER JOIN club_award_albums caa ON caa.id = cap.album_id
  LEFT JOIN homepage_sections hs ON hs.id = cap.loft_id
`;

export async function listClubAwardAlbums(
  options: ListClubAwardAlbumsOptions = {},
): Promise<{ items: ClubAwardAlbum[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  const search = options.search?.trim();
  if (search) {
    conditions.push("caa.name LIKE ?");
    params.push(`%${search}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM club_award_albums caa ${where}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const { offset, limit } = paginate(options.page, options.pageSize ?? DEFAULT_CLUB_AWARD_PAGE_SIZE);

  const [rows] = await db.query(
    `${SELECT_ALBUM_WITH_STATS} ${where} ORDER BY caa.sort_order ASC, caa.id ASC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: (rows as ClubAwardAlbumRow[]).map(mapAlbumRow), total };
}

export async function listLatestClubAwardAlbums(limit: number): Promise<ClubAwardAlbum[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `${SELECT_ALBUM_WITH_STATS} ORDER BY caa.created_at DESC, caa.id DESC LIMIT ?`,
    [limit],
  );
  return (rows as ClubAwardAlbumRow[]).map(mapAlbumRow);
}

/** Home/public curated ordering, limited to the first `limit` albums. */
export async function listTopClubAwardAlbums(limit: number): Promise<ClubAwardAlbum[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `${SELECT_ALBUM_WITH_STATS} ORDER BY caa.sort_order ASC, caa.id ASC LIMIT ?`,
    [limit],
  );
  return (rows as ClubAwardAlbumRow[]).map(mapAlbumRow);
}

export async function listAllClubAwardAlbums(): Promise<ClubAwardAlbum[]> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT_ALBUM_WITH_STATS} ORDER BY caa.sort_order ASC, caa.id ASC`);
  return (rows as ClubAwardAlbumRow[]).map(mapAlbumRow);
}

export async function getClubAwardAlbumById(id: number): Promise<ClubAwardAlbum | null> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT_ALBUM_WITH_STATS} WHERE caa.id = ? LIMIT 1`, [id]);
  const row = (rows as ClubAwardAlbumRow[])[0];
  return row ? mapAlbumRow(row) : null;
}

export async function createClubAwardAlbum(
  name: string,
  sortOrder?: number,
): Promise<ClubAwardOutcome & { id?: number }> {
  if (sortOrder !== undefined && !isValidClubAwardSortOrder(sortOrder)) {
    return { ok: false, error: "排序值必須是大於或等於 0 的整數" };
  }
  const db = await getDb();
  let finalSortOrder = sortOrder;
  if (finalSortOrder === undefined) {
    const [rows] = await db.query("SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order FROM club_award_albums");
    finalSortOrder = Number((rows as { max_sort_order: number }[])[0].max_sort_order) + 1;
  }
  const [result] = await db.query(
    "INSERT INTO club_award_albums (name, sort_order, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
    [name, finalSortOrder],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

export async function updateClubAwardAlbum(
  id: number,
  name: string,
  sortOrder?: number,
): Promise<ClubAwardOutcome> {
  if (sortOrder !== undefined && !isValidClubAwardSortOrder(sortOrder)) {
    return { ok: false, error: "排序值必須是大於或等於 0 的整數" };
  }
  const db = await getDb();
  const [result] =
    sortOrder === undefined
      ? await db.query("UPDATE club_award_albums SET name = ?, updated_at = NOW() WHERE id = ?", [name, id])
      : await db.query("UPDATE club_award_albums SET name = ?, sort_order = ?, updated_at = NOW() WHERE id = ?", [
          name,
          sortOrder,
          id,
        ]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個相簿" };
  }
  return { ok: true };
}

export async function deleteClubAwardAlbum(id: number): Promise<ClubAwardOutcome> {
  const db = await getDb();
  const [countRows] = await db.query("SELECT COUNT(*) AS cnt FROM club_award_pigeons WHERE album_id = ?", [id]);
  const count = Number((countRows as { cnt: number }[])[0]?.cnt ?? 0);
  if (count > 0) {
    return {
      ok: false,
      error: `此相簿尚有 ${count} 筆鴿子資料，請先刪除或移轉相簿內的鴿子後再刪除`,
    };
  }

  const [result] = await db.query("DELETE FROM club_award_albums WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個相簿" };
  }
  return { ok: true };
}

async function albumExists(albumId: number): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query("SELECT 1 FROM club_award_albums WHERE id = ? LIMIT 1", [albumId]);
  return (rows as unknown[]).length > 0;
}

async function isPartnerLoft(loftId: number): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT 1 FROM homepage_sections WHERE id = ? AND section_type = 'partner_loft' LIMIT 1",
    [loftId],
  );
  return (rows as unknown[]).length > 0;
}

export async function listClubAwardPigeons(
  options: ListClubAwardPigeonsOptions = {},
): Promise<{ items: ClubAwardPigeon[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.albumId !== undefined) {
    conditions.push("cap.album_id = ?");
    params.push(options.albumId);
  }
  if (options.category) {
    conditions.push("cap.category = ?");
    params.push(options.category);
  }
  const search = options.search?.trim();
  if (search) {
    conditions.push("cap.name LIKE ?");
    params.push(`%${search}%`);
  }
  if (options.loftId !== undefined) {
    conditions.push("cap.loft_id = ?");
    params.push(options.loftId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM club_award_pigeons cap ${where}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const { offset, limit } = paginate(options.page, options.pageSize ?? DEFAULT_CLUB_AWARD_PAGE_SIZE);

  const [rows] = await db.query(
    `${SELECT_PIGEON_WITH_JOINS} ${where} ORDER BY ${
      options.albumId === undefined
        ? "caa.sort_order ASC, caa.id ASC, cap.sort_order ASC, cap.id ASC"
        : "cap.sort_order ASC, cap.id ASC"
    } LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: (rows as ClubAwardPigeonRow[]).map(mapPigeonRow), total };
}

export async function listLatestClubAwardPigeonsByAlbum(albumId: number, limit: number): Promise<ClubAwardPigeon[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `${SELECT_PIGEON_WITH_JOINS} WHERE cap.album_id = ? ORDER BY cap.created_at DESC, cap.id DESC LIMIT ?`,
    [albumId, limit],
  );
  return (rows as ClubAwardPigeonRow[]).map(mapPigeonRow);
}

export async function getClubAwardPigeonById(id: number): Promise<ClubAwardPigeon | null> {
  const db = await getDb();
  const [rows] = await db.query(`${SELECT_PIGEON_WITH_JOINS} WHERE cap.id = ? LIMIT 1`, [id]);
  const row = (rows as ClubAwardPigeonRow[])[0];
  return row ? mapPigeonRow(row) : null;
}

export async function createClubAwardPigeon(
  input: ClubAwardPigeonInput,
): Promise<ClubAwardOutcome & { id?: number }> {
  if (input.sortOrder !== undefined && !isValidClubAwardSortOrder(input.sortOrder)) {
    return { ok: false, error: "排序值必須是大於或等於 0 的整數" };
  }
  if (!(await albumExists(input.albumId))) {
    return { ok: false, error: "找不到這個相簿" };
  }
  if (input.loftId != null) {
    if (!(await isPartnerLoft(input.loftId))) {
      return { ok: false, error: "找不到這個合作鴿舍" };
    }
  }
  const db = await getDb();
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [rows] = await db.query(
      "SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order FROM club_award_pigeons WHERE album_id = ?",
      [input.albumId],
    );
    sortOrder = Number((rows as { max_sort_order: number }[])[0].max_sort_order) + 1;
  }
  const [result] = await db.query(
    `INSERT INTO club_award_pigeons (album_id, sort_order, category, name, loft_id, photo_source, image_file_name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      input.albumId,
      sortOrder,
      input.category,
      input.name,
      input.loftId ?? null,
      input.photoSource ?? null,
      input.imageFileName,
      input.description,
    ],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

export async function updateClubAwardPigeon(id: number, input: ClubAwardPigeonInput): Promise<ClubAwardOutcome> {
  if (input.sortOrder !== undefined && !isValidClubAwardSortOrder(input.sortOrder)) {
    return { ok: false, error: "排序值必須是大於或等於 0 的整數" };
  }
  if (!(await albumExists(input.albumId))) {
    return { ok: false, error: "找不到這個相簿" };
  }
  if (input.loftId != null) {
    if (!(await isPartnerLoft(input.loftId))) {
      return { ok: false, error: "找不到這個合作鴿舍" };
    }
  }
  const db = await getDb();
  const [currentRows] = await db.query(
    "SELECT album_id, sort_order FROM club_award_pigeons WHERE id = ? LIMIT 1",
    [id],
  );
  const current = (currentRows as { album_id: number; sort_order: number }[])[0];
  if (!current) return { ok: false, error: "找不到這筆入賞鴿資料" };

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    if (Number(current.album_id) === input.albumId) {
      sortOrder = Number(current.sort_order);
    } else {
      const [rows] = await db.query(
        "SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order FROM club_award_pigeons WHERE album_id = ?",
        [input.albumId],
      );
      sortOrder = Number((rows as { max_sort_order: number }[])[0].max_sort_order) + 1;
    }
  }
  const [result] = await db.query(
    `UPDATE club_award_pigeons
     SET album_id = ?, sort_order = ?, category = ?, name = ?, loft_id = ?, photo_source = ?, image_file_name = ?, description = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      input.albumId,
      sortOrder,
      input.category,
      input.name,
      input.loftId ?? null,
      input.photoSource ?? null,
      input.imageFileName,
      input.description,
      id,
    ],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這筆入賞鴿資料" };
  }
  return { ok: true };
}

export async function updateClubAwardPigeonDescription(id: number, description: string): Promise<void> {
  const db = await getDb();
  await db.query("UPDATE club_award_pigeons SET description = ? WHERE id = ?", [description, id]);
}

export async function deleteClubAwardPigeon(id: number): Promise<ClubAwardOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM club_award_pigeons WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這筆入賞鴿資料" };
  }
  return { ok: true };
}
