// CRUD for `pigeon_groups` (see db/init.sql) — issue #260's 鴿會查詢, a
// sibling directory to lib/pigeonShops.ts's 鴿店地圖目錄. Rows are seeded
// once by scripts/import-cb-pigeon-groups.mjs (a one-time crawl of
// cb-pigeon.com, run by hand — see that script's header comment) and
// afterwards maintained by hand through the admin CRUD page
// (app/z04urru6/pigeon-groups). Deliberately no write-lock / invariant
// machinery like lib/homepageVideos.ts's "max 6 active" guard — there is no
// analogous cross-row constraint here, just a flat address-book list.

import { getDb } from "@/lib/db";

export interface PigeonGroup {
  id: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  chairmanName: string | null;
  chairmanPhone: string | null;
  secretaryName: string | null;
  secretaryPhone: string | null;
  websiteUrl: string | null;
  pigeonTrackingUrl: string | null;
  sourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPigeonGroupInput {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  chairmanName?: string | null;
  chairmanPhone?: string | null;
  secretaryName?: string | null;
  secretaryPhone?: string | null;
  websiteUrl?: string | null;
  pigeonTrackingUrl?: string | null;
  sourceUrl: string;
}

export interface UpdatePigeonGroupInput {
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  chairmanName: string | null;
  chairmanPhone: string | null;
  secretaryName: string | null;
  secretaryPhone: string | null;
  websiteUrl: string | null;
  pigeonTrackingUrl: string | null;
  sourceUrl: string;
}

interface PigeonGroupRow {
  id: number;
  name: string;
  address: string | null;
  lat: string | number | null;
  lng: string | number | null;
  chairman_name: string | null;
  chairman_phone: string | null;
  secretary_name: string | null;
  secretary_phone: string | null;
  website_url: string | null;
  pigeon_tracking_url: string | null;
  source_url: string;
  created_at: Date;
  updated_at: Date;
}

const NAME_MAX = 200;
const ADDRESS_MAX = 255;
const PERSON_NAME_MAX = 100;
const PHONE_MAX = 100;
const URL_MAX = 500;
const SOURCE_URL_MAX = 500;

// mysql2 returns DECIMAL columns as strings by default — normalize to number
// (or null) once here so every caller gets a plain JS number.
function toNumberOrNull(value: string | number | null): number | null {
  if (value === null) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapRow(row: PigeonGroupRow): PigeonGroup {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: toNumberOrNull(row.lat),
    lng: toNumberOrNull(row.lng),
    chairmanName: row.chairman_name,
    chairmanPhone: row.chairman_phone,
    secretaryName: row.secretary_name,
    secretaryPhone: row.secretary_phone,
    websiteUrl: row.website_url,
    pigeonTrackingUrl: row.pigeon_tracking_url,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPigeonGroups(): Promise<PigeonGroup[]> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM pigeon_groups ORDER BY name ASC, id ASC");
  return (rows as PigeonGroupRow[]).map(mapRow);
}

export async function getPigeonGroup(id: number): Promise<PigeonGroup | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM pigeon_groups WHERE id = ? LIMIT 1", [id]);
  const rowList = rows as PigeonGroupRow[];
  if (rowList.length === 0) return null;
  return mapRow(rowList[0]);
}

function validate(input: {
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  chairmanName?: string | null;
  chairmanPhone?: string | null;
  secretaryName?: string | null;
  secretaryPhone?: string | null;
  websiteUrl?: string | null;
  pigeonTrackingUrl?: string | null;
  sourceUrl: string;
}): string | null {
  if (!input.name.trim()) return "請輸入鴿會名稱";
  if (input.name.length > NAME_MAX) return `鴿會名稱上限 ${NAME_MAX} 字`;
  if (input.address && input.address.length > ADDRESS_MAX) return `地址上限 ${ADDRESS_MAX} 字`;
  // Same range checks as app/api/admin/pigeon-groups' route handlers —
  // duplicated here (rather than relying solely on the route) so any future
  // caller of this module gets the same guarantee, matching
  // lib/pigeonStations.ts's precedent.
  if (input.lat !== undefined && input.lat !== null && (!Number.isFinite(input.lat) || input.lat < -90 || input.lat > 90)) {
    return "緯度必須介於 -90 到 90 之間";
  }
  if (input.lng !== undefined && input.lng !== null && (!Number.isFinite(input.lng) || input.lng < -180 || input.lng > 180)) {
    return "經度必須介於 -180 到 180 之間";
  }
  if (input.chairmanName && input.chairmanName.length > PERSON_NAME_MAX) return `會長姓名上限 ${PERSON_NAME_MAX} 字`;
  if (input.chairmanPhone && input.chairmanPhone.length > PHONE_MAX) return `會長電話上限 ${PHONE_MAX} 字`;
  if (input.secretaryName && input.secretaryName.length > PERSON_NAME_MAX) return `秘書姓名上限 ${PERSON_NAME_MAX} 字`;
  if (input.secretaryPhone && input.secretaryPhone.length > PHONE_MAX) return `秘書電話上限 ${PHONE_MAX} 字`;
  if (input.websiteUrl && input.websiteUrl.length > URL_MAX) return `官網網址上限 ${URL_MAX} 字`;
  if (input.pigeonTrackingUrl && input.pigeonTrackingUrl.length > URL_MAX) return `即時返鴿查詢網址上限 ${URL_MAX} 字`;
  // sourceUrl is required for scraped rows (scripts/import-cb-pigeon-groups.mjs
  // always sets it to the cb-pigeon.com detail page it came from) but optional
  // here — a row added by hand through this admin CRUD has no such source.
  if (input.sourceUrl.length > SOURCE_URL_MAX) return `原文網址上限 ${SOURCE_URL_MAX} 字`;
  return null;
}

function normalizeInput(input: {
  name: string;
  address?: string | null;
  chairmanName?: string | null;
  chairmanPhone?: string | null;
  secretaryName?: string | null;
  secretaryPhone?: string | null;
  websiteUrl?: string | null;
  pigeonTrackingUrl?: string | null;
  sourceUrl: string;
}) {
  return {
    name: input.name.trim(),
    address: input.address?.trim() || null,
    chairmanName: input.chairmanName?.trim() || null,
    chairmanPhone: input.chairmanPhone?.trim() || null,
    secretaryName: input.secretaryName?.trim() || null,
    secretaryPhone: input.secretaryPhone?.trim() || null,
    websiteUrl: input.websiteUrl?.trim() || null,
    pigeonTrackingUrl: input.pigeonTrackingUrl?.trim() || null,
    sourceUrl: input.sourceUrl.trim(),
  };
}

export async function createPigeonGroup(
  input: NewPigeonGroupInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const normalized = normalizeInput(input);

  const error = validate({ ...normalized, lat: input.lat, lng: input.lng });
  if (error) return { ok: false, error };

  const db = await getDb();
  const [result] = await db.query(
    `INSERT INTO pigeon_groups
       (name, address, lat, lng, chairman_name, chairman_phone, secretary_name, secretary_phone,
        website_url, pigeon_tracking_url, source_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      normalized.name,
      normalized.address,
      input.lat ?? null,
      input.lng ?? null,
      normalized.chairmanName,
      normalized.chairmanPhone,
      normalized.secretaryName,
      normalized.secretaryPhone,
      normalized.websiteUrl,
      normalized.pigeonTrackingUrl,
      normalized.sourceUrl,
    ],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

export async function updatePigeonGroup(
  id: number,
  input: UpdatePigeonGroupInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeInput(input);

  const error = validate({ ...normalized, lat: input.lat, lng: input.lng });
  if (error) return { ok: false, error };

  const db = await getDb();
  const [result] = await db.query(
    `UPDATE pigeon_groups
     SET name = ?, address = ?, lat = ?, lng = ?, chairman_name = ?, chairman_phone = ?,
         secretary_name = ?, secretary_phone = ?, website_url = ?, pigeon_tracking_url = ?,
         source_url = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      normalized.name,
      normalized.address,
      input.lat,
      input.lng,
      normalized.chairmanName,
      normalized.chairmanPhone,
      normalized.secretaryName,
      normalized.secretaryPhone,
      normalized.websiteUrl,
      normalized.pigeonTrackingUrl,
      normalized.sourceUrl,
      id,
    ],
  );
  const affectedRows = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affectedRows === 0) return { ok: false, error: "找不到該鴿會資料" };
  return { ok: true };
}

export async function deletePigeonGroup(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM pigeon_groups WHERE id = ?", [id]);
  const affectedRows = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affectedRows === 0) return { ok: false, error: "找不到該鴿會資料" };
  return { ok: true };
}
