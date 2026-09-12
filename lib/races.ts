// CRUD for `races` (see db/init.sql / lib/db.ts's SCHEMA_SQL) — 賽事資訊
// (issue #241). Hand-written SQL via mysql2, same style as lib/news.ts (this
// project has no ORM). Unlike news_posts, rows here are UPSERTed by
// lib/racesSync.ts every sync run (keyed on source_url) rather than
// imported once and left alone — a race's status/content legitimately
// changes over time (current -> finished, a winner appearing once a race
// completes), so there is no locked_by_admin/import-log concept to preserve
// here.

import { getDb } from "@/lib/db";
import { paginate } from "@/lib/pagination";

/** 'loing_ma' — loing-ma.com (台灣/亞洲); 'herbots' — herbots.be (歐洲). Never matched/merged across sources — see db/init.sql. */
export type RaceSource = "loing_ma" | "herbots";

/** 正在進行 / 即將開賽 / 過往賽事 — see db/init.sql for how each source populates this. */
export type RaceStatus = "current" | "future" | "finished";

export const RACE_STATUSES: readonly RaceStatus[] = ["current", "future", "finished"];

export function isRaceStatus(value: string): value is RaceStatus {
  return (RACE_STATUSES as readonly string[]).includes(value);
}

export interface Race {
  id: number;
  source: RaceSource;
  status: RaceStatus;
  /** Traditional Chinese — verbatim for 'loing_ma' rows, Cloudflare-Workers-AI-translated for 'herbots' rows. */
  title: string;
  /** Pre-translation title; NULL on 'loing_ma' rows (never translated). */
  originalTitle: string | null;
  /** Sanitized HTML (see lib/sanitizeDescriptionHtml.ts). */
  content: string;
  /** Sanitized HTML, pre-translation; NULL on 'loing_ma' rows. */
  originalContent: string | null;
  /** 開賽日期 (race start/release date); NULL when the source gave no usable date. */
  raceDate: Date | null;
  /** 主圖 file name under uploads/races/ (see lib/uploads.ts); NULL when the source had no photo. */
  imageFileName: string | null;
  /** Original article/thread URL — de-dup + upsert key. */
  sourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

// Fields lib/racesSync.ts supplies for one upsert — every sync run writes
// through this shape regardless of source, so a race that moves from
// 'current' to 'finished' (or gains a winner photo) is reflected on the next
// run rather than only ever written once.
export interface RaceUpsertInput {
  source: RaceSource;
  status: RaceStatus;
  title: string;
  originalTitle: string | null;
  content: string;
  originalContent: string | null;
  raceDate: Date | null;
  imageFileName: string | null;
  sourceUrl: string;
}

export const RACE_PAGE_SIZES = [30, 50, 100] as const;
export type RacePageSize = (typeof RACE_PAGE_SIZES)[number];
export const DEFAULT_RACE_PAGE_SIZE: RacePageSize = 30;

export function isRacePageSize(value: number): value is RacePageSize {
  return (RACE_PAGE_SIZES as readonly number[]).includes(value);
}

export interface ListRacesOptions {
  /** Filter to one status tag — omitted/undefined lists every status. */
  status?: RaceStatus;
  page?: number;
  pageSize?: RacePageSize;
}

interface RaceRow {
  id: number;
  source: RaceSource;
  status: RaceStatus;
  title: string;
  original_title: string | null;
  content: string;
  original_content: string | null;
  race_date: Date | null;
  image_file_name: string | null;
  source_url: string;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: RaceRow): Race {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    title: row.title,
    originalTitle: row.original_title,
    content: row.content,
    originalContent: row.original_content,
    raceDate: row.race_date,
    imageFileName: row.image_file_name,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT = `SELECT id, source, status, title, original_title, content, original_content, race_date, image_file_name, source_url, created_at, updated_at FROM races`;

// Both sources are merged and sorted by race_date alone (issue #241: "在畫面
// 上合併依「開賽日期」排序顯示") — newest/soonest race_date first, same
// newest-first convention as news_posts' ORDER_BY_LATEST. A NULL race_date
// (a source row with no usable date) sorts last rather than first/crashing
// the comparison.
const ORDER_BY_RACE_DATE = "ORDER BY race_date IS NULL, race_date DESC, id DESC";

// Powers the public /races list page — optionally filtered to one status tag
// (正在進行/即將開賽/過往賽事), otherwise every status together.
export async function listRaces(options: ListRacesOptions = {}): Promise<{ items: Race[]; total: number }> {
  const db = await getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.status) {
    conditions.push("status = ?");
    params.push(options.status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await db.query(`SELECT COUNT(*) AS cnt FROM races ${where}`, params);
  const total = (countRows as { cnt: number }[])[0].cnt;

  const { offset, limit } = paginate(options.page, options.pageSize ?? DEFAULT_RACE_PAGE_SIZE);

  const [rows] = await db.query(`${SELECT} ${where} ${ORDER_BY_RACE_DATE} LIMIT ${limit} OFFSET ${offset}`, params);
  return { items: (rows as RaceRow[]).map(mapRow), total };
}

// Homepage "賽事資訊" section (issue #241) — prioritizes the most
// operationally relevant races first (an ongoing race outranks an upcoming
// one, which outranks a finished one) rather than pure race_date order, so a
// small homepage slot doesn't fill up with old finished races while a
// current one scrolls off. Within each status group, still newest/soonest
// race_date first.
export async function listHomepageRaces(limit: number): Promise<Race[]> {
  const db = await getDb();
  const [rows] = await db.query(
    `${SELECT}
     ORDER BY FIELD(status, 'current', 'future', 'finished'), race_date IS NULL, race_date DESC, id DESC
     LIMIT ?`,
    [limit],
  );
  return (rows as RaceRow[]).map(mapRow);
}

export type RaceUpsertOutcome = { ok: true; inserted: boolean } | { ok: false; error: string };

// lib/racesSync.ts's only write path — INSERT ... ON DUPLICATE KEY UPDATE
// keyed on source_url (UNIQUE, see db/init.sql), so re-running the sync for
// an already-known race updates its status/content/image in place instead of
// erroring or creating a duplicate row. `inserted` tells the caller whether
// this was a brand-new race (for its own imported/updated counters) —
// mysql2's affectedRows is 1 for a fresh INSERT and 2 for a row the UPDATE
// clause actually changed (0 if the values were already identical).
export async function upsertRace(input: RaceUpsertInput): Promise<RaceUpsertOutcome> {
  const db = await getDb();
  try {
    const [result] = await db.query(
      `INSERT INTO races
         (source, status, title, original_title, content, original_content, race_date, image_file_name, source_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         title = VALUES(title),
         original_title = VALUES(original_title),
         content = VALUES(content),
         original_content = VALUES(original_content),
         race_date = VALUES(race_date),
         image_file_name = COALESCE(VALUES(image_file_name), image_file_name),
         updated_at = NOW()`,
      [
        input.source,
        input.status,
        input.title,
        input.originalTitle,
        input.content,
        input.originalContent,
        input.raceDate,
        input.imageFileName,
        input.sourceUrl,
      ],
    );
    const affectedRows = (result as { affectedRows: number }).affectedRows;
    return { ok: true, inserted: affectedRows === 1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
