// CRUD for `pigeon_shops` (see db/init.sql) — issue #243's 鴿店地圖目錄.
// Rows are seeded once by scripts/import-pigeon-shops.mjs (a one-time crawl
// of nicepigeon.com, run by hand — see that script's header comment) and
// afterwards maintained by hand through the admin CRUD page
// (app/z04urru6/pigeon-shops). Deliberately no write-lock / invariant
// machinery like lib/homepageVideos.ts's "max 6 active" guard — there is no
// analogous cross-row constraint here, just a flat address-book list.

import { getDb } from "@/lib/db";

export interface PigeonShop {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  // e.g. "賽鴿飼料-台北地區" (issue #259, cb-pigeon.com import). NULL on rows
  // scraped by scripts/import-pigeon-shops.mjs (nicepigeon.com), which has no
  // equivalent field, and on hand-added admin rows that leave it blank.
  category: string | null;
  sourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPigeonShopInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  sourceUrl: string;
}

export interface UpdatePigeonShopInput {
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  sourceUrl: string;
}

interface PigeonShopRow {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  lat: string | number | null;
  lng: string | number | null;
  category: string | null;
  source_url: string;
  created_at: Date;
  updated_at: Date;
}

const NAME_MAX = 200;
const PHONE_MAX = 50;
const ADDRESS_MAX = 255;
const CATEGORY_MAX = 100;
const SOURCE_URL_MAX = 500;

// mysql2 returns DECIMAL columns as strings by default — normalize to number
// (or null) once here so every caller gets a plain JS number.
function toNumberOrNull(value: string | number | null): number | null {
  if (value === null) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function mapRow(row: PigeonShopRow): PigeonShop {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    lat: toNumberOrNull(row.lat),
    lng: toNumberOrNull(row.lng),
    category: row.category,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPigeonShops(): Promise<PigeonShop[]> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM pigeon_shops ORDER BY name ASC, id ASC");
  return (rows as PigeonShopRow[]).map(mapRow);
}

export async function getPigeonShop(id: number): Promise<PigeonShop | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM pigeon_shops WHERE id = ? LIMIT 1", [id]);
  const rowList = rows as PigeonShopRow[];
  if (rowList.length === 0) return null;
  return mapRow(rowList[0]);
}

function validate(input: {
  name: string;
  phone?: string | null;
  address?: string | null;
  category?: string | null;
  sourceUrl: string;
}): string | null {
  if (!input.name.trim()) return "請輸入店名";
  if (input.name.length > NAME_MAX) return `店名上限 ${NAME_MAX} 字`;
  if (input.phone && input.phone.length > PHONE_MAX) return `電話上限 ${PHONE_MAX} 字`;
  if (input.address && input.address.length > ADDRESS_MAX) return `地址上限 ${ADDRESS_MAX} 字`;
  if (input.category && input.category.length > CATEGORY_MAX) return `分類上限 ${CATEGORY_MAX} 字`;
  // sourceUrl is required for scraped rows (scripts/import-pigeon-shops.mjs
  // always sets it to the nicepigeon.com article it came from) but optional
  // here — a row added by hand through this admin CRUD has no such source.
  if (input.sourceUrl.length > SOURCE_URL_MAX) return `原文網址上限 ${SOURCE_URL_MAX} 字`;
  return null;
}

export async function createPigeonShop(
  input: NewPigeonShopInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;
  const category = input.category?.trim() || null;
  const sourceUrl = input.sourceUrl.trim();

  const error = validate({ name, phone, address, category, sourceUrl });
  if (error) return { ok: false, error };

  const db = await getDb();
  const [result] = await db.query(
    `INSERT INTO pigeon_shops (name, phone, address, lat, lng, category, source_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [name, phone, address, input.lat ?? null, input.lng ?? null, category, sourceUrl],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

export async function updatePigeonShop(
  id: number,
  input: UpdatePigeonShopInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  const address = input.address?.trim() || null;
  const category = input.category?.trim() || null;
  const sourceUrl = input.sourceUrl.trim();

  const error = validate({ name, phone, address, category, sourceUrl });
  if (error) return { ok: false, error };

  const db = await getDb();
  const [result] = await db.query(
    `UPDATE pigeon_shops
     SET name = ?, phone = ?, address = ?, lat = ?, lng = ?, category = ?, source_url = ?, updated_at = NOW()
     WHERE id = ?`,
    [name, phone, address, input.lat, input.lng, category, sourceUrl, id],
  );
  const affectedRows = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affectedRows === 0) return { ok: false, error: "找不到該鴿店資料" };
  return { ok: true };
}

export async function deletePigeonShop(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM pigeon_shops WHERE id = ?", [id]);
  const affectedRows = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affectedRows === 0) return { ok: false, error: "找不到該鴿店資料" };
  return { ok: true };
}
