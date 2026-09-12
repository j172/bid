// CRUD for `pigeon_stations` (issue #242 / Epic #239) — 全台取鴿站地圖目錄。
// Rows are seeded once by scripts/import-pigeon-stations.mjs (a one-time
// import from nicepigeon.com, NOT wired into lib/scheduler.ts's daily cron)
// and afterwards maintained by hand through the admin CRUD at
// app/z04urru6/pigeon-stations. Modeled directly on lib/homepageSections.ts
// (no active flag / sort_order here — every row is always shown on the
// public map+list, and display order is a plain name sort).
// Hand-written SQL via mysql2, same style as the rest of this project (no
// ORM).

import { getDb } from "@/lib/db";

export interface PigeonStation {
  id: number;
  name: string;
  phone: string;
  address: string;
  /** Null when the import script's Nominatim geocoding attempt failed for
   * this address (e.g. too vague to resolve) — the public map skips such
   * rows, the list still shows them. */
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PigeonStationInput {
  name: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  sourceUrl: string;
}

export type PigeonStationOutcome = { ok: true } | { ok: false; error: string };

interface PigeonStationRow {
  id: number;
  name: string;
  phone: string;
  address: string;
  // DECIMAL columns come back from mysql2 as strings unless decimalNumbers
  // is set on the pool (it isn't — same as lib/exchangeRates.ts's `rate`).
  lat: string | number | null;
  lng: string | number | null;
  source_url: string;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: PigeonStationRow): PigeonStation {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const NAME_MAX = 100;
const PHONE_MAX = 50;
const ADDRESS_MAX = 255;
const SOURCE_URL_MAX = 500;

function validateLat(lat: number | null): string | null {
  if (lat === null) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return "緯度必須介於 -90 到 90 之間";
  return null;
}

function validateLng(lng: number | null): string | null {
  if (lng === null) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return "經度必須介於 -180 到 180 之間";
  return null;
}

// Shared create/update field validation. Returns the trimmed fields on
// success so callers never re-trim, or an error string on the first
// violation found.
function validateInput(
  input: PigeonStationInput,
): { ok: true; value: PigeonStationInput } | { ok: false; error: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "請輸入取鴿站名稱" };
  if (name.length > NAME_MAX) return { ok: false, error: `名稱上限 ${NAME_MAX} 字` };

  const phone = input.phone.trim();
  if (!phone) return { ok: false, error: "請輸入聯絡電話" };
  if (phone.length > PHONE_MAX) return { ok: false, error: `電話上限 ${PHONE_MAX} 字` };

  const address = input.address.trim();
  if (!address) return { ok: false, error: "請輸入地址" };
  if (address.length > ADDRESS_MAX) return { ok: false, error: `地址上限 ${ADDRESS_MAX} 字` };

  const sourceUrl = input.sourceUrl.trim();
  if (!sourceUrl) return { ok: false, error: "請輸入資料來源網址" };
  if (sourceUrl.length > SOURCE_URL_MAX) return { ok: false, error: `來源網址上限 ${SOURCE_URL_MAX} 字` };

  const latError = validateLat(input.lat);
  if (latError) return { ok: false, error: latError };
  const lngError = validateLng(input.lng);
  if (lngError) return { ok: false, error: lngError };

  return { ok: true, value: { name, phone, address, lat: input.lat, lng: input.lng, sourceUrl } };
}

// Ordered by name so both the admin list and the public list/map stay
// stable and predictable without a dedicated sort_order column — there is
// no drag-and-drop reordering requirement for this ticket.
export async function listPigeonStations(): Promise<PigeonStation[]> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM pigeon_stations ORDER BY name ASC, id ASC");
  return (rows as PigeonStationRow[]).map(mapRow);
}

export async function getPigeonStationById(id: number): Promise<PigeonStation | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM pigeon_stations WHERE id = ? LIMIT 1", [id]);
  const row = (rows as PigeonStationRow[])[0];
  return row ? mapRow(row) : null;
}

export async function createPigeonStation(
  input: PigeonStationInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const validated = validateInput(input);
  if (!validated.ok) return validated;
  const { name, phone, address, lat, lng, sourceUrl } = validated.value;

  const db = await getDb();
  const [result] = await db.query(
    `INSERT INTO pigeon_stations (name, phone, address, lat, lng, source_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [name, phone, address, lat, lng, sourceUrl],
  );
  return { ok: true, id: (result as { insertId: number }).insertId };
}

export async function updatePigeonStation(id: number, input: PigeonStationInput): Promise<PigeonStationOutcome> {
  const validated = validateInput(input);
  if (!validated.ok) return validated;
  const { name, phone, address, lat, lng, sourceUrl } = validated.value;

  const db = await getDb();
  const [result] = await db.query(
    `UPDATE pigeon_stations
     SET name = ?, phone = ?, address = ?, lat = ?, lng = ?, source_url = ?, updated_at = NOW()
     WHERE id = ?`,
    [name, phone, address, lat, lng, sourceUrl, id],
  );
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個取鴿站" };
  }
  return { ok: true };
}

export async function deletePigeonStation(id: number): Promise<PigeonStationOutcome> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM pigeon_stations WHERE id = ?", [id]);
  if ((result as { affectedRows: number }).affectedRows === 0) {
    return { ok: false, error: "找不到這個取鴿站" };
  }
  return { ok: true };
}
