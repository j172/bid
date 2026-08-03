// Daily TWD/USD + TWD/CNY exchange-rate sync (issue #45) — fetched from
// TAIFEX's public open-data feed and cached in `exchange_rates` (see
// db/init.sql) so every page render doesn't have to hit TAIFEX itself.
// Hand-written SQL via mysql2, same style as lib/listings.ts (no ORM).
//
// The real response from
// https://www.taifex.com.tw/data_gov/taifex_open_data.asp?data_name=DailyForeignExchangeRates
// is a UTF-8 (BOM-prefixed) CSV covering the current calendar month,
// oldest-row-first, one row per published trading day:
//
//   日期,美元_新台幣(匯率),人民幣_新台幣(匯率),歐元_美元(匯率),...
//   20260701,31.874,4.687295,1.14005,...
//   ...
//   20260803,32.438,4.80303,1.1527,...
//
// Column 1 is YYYYMMDD; column 2 is TWD per 1 USD; column 3 is TWD per 1
// CNY. Only those three columns matter here — the rest (EUR/USD, USD/JPY,
// etc.) are irrelevant to this site's zh-TW/zh-CN/en currency display.
import { getDb } from "@/lib/db";

export type CurrencyCode = "USD" | "CNY";
export const CURRENCY_CODES: CurrencyCode[] = ["USD", "CNY"];

const TAIFEX_URL = "https://www.taifex.com.tw/data_gov/taifex_open_data.asp?data_name=DailyForeignExchangeRates";

export interface TaifexRow {
  /** YYYY-MM-DD */
  date: string;
  /** TWD per 1 USD */
  usdTwd: number;
  /** TWD per 1 CNY */
  cnyTwd: number;
}

// Pure/sync so it's directly unit-testable without mocking fetch. Tolerant
// of a leading BOM and blank trailing lines; skips any row that doesn't
// parse cleanly (defensive against a format change upstream) rather than
// throwing and taking the whole sync down.
export function parseTaifexCsv(csvText: string): TaifexRow[] {
  const withoutBom = csvText.replace(/^﻿/, "");
  const lines = withoutBom.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows: TaifexRow[] = [];

  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const rawDate = cols[0]?.trim();
    const rawUsd = cols[1]?.trim();
    const rawCny = cols[2]?.trim();
    const usdTwd = Number(rawUsd);
    const cnyTwd = Number(rawCny);
    if (
      !rawDate ||
      !/^\d{8}$/.test(rawDate) ||
      !rawUsd ||
      !rawCny ||
      !Number.isFinite(usdTwd) ||
      !Number.isFinite(cnyTwd)
    ) {
      continue;
    }
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    rows.push({ date, usdTwd, cnyTwd });
  }

  return rows;
}

// Fetches the TAIFEX feed and returns its most recent row (the feed is
// already oldest-first for the current month, so the last row is the
// latest published trading day) — or null on any network/parse failure, in
// which case syncExchangeRates falls back to the last successfully stored
// rate instead.
export async function fetchLatestTaifexRow(): Promise<TaifexRow | null> {
  try {
    const response = await fetch(TAIFEX_URL);
    if (!response.ok) return null;
    const text = await response.text();
    const rows = parseTaifexCsv(text);
    return rows.length > 0 ? rows[rows.length - 1] : null;
  } catch {
    return null;
  }
}

export interface StoredExchangeRate {
  currency: CurrencyCode;
  rate: number;
  /** Calendar date this row was synced for (usually "today"). */
  rateDate: string;
  /** Trading date the `rate` value actually came from — trails rateDate on fallback. */
  sourceDate: string;
}

interface ExchangeRateRow {
  currency: CurrencyCode;
  rate: string | number;
  rate_date: string | Date;
  source_date: string | Date;
}

function toDateString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapRow(row: ExchangeRateRow): StoredExchangeRate {
  return {
    currency: row.currency,
    rate: Number(row.rate),
    rateDate: toDateString(row.rate_date),
    sourceDate: toDateString(row.source_date),
  };
}

// Most recently stored rate for a currency, regardless of whether "today"'s
// sync has run yet — this is the read path pages/footer use, so an early
// call (e.g. right after a restart, before the first cron tick) still shows
// yesterday's rate rather than nothing.
export async function getLatestStoredRate(currency: CurrencyCode): Promise<StoredExchangeRate | null> {
  const db = await getDb();
  const [rows] = await db.query(
    "SELECT currency, rate, rate_date, source_date FROM exchange_rates WHERE currency = ? ORDER BY rate_date DESC LIMIT 1",
    [currency],
  );
  const row = (rows as ExchangeRateRow[])[0];
  return row ? mapRow(row) : null;
}

export async function getAllLatestStoredRates(): Promise<Record<CurrencyCode, StoredExchangeRate | null>> {
  const [usd, cny] = await Promise.all([getLatestStoredRate("USD"), getLatestStoredRate("CNY")]);
  return { USD: usd, CNY: cny };
}

async function upsertRate(currency: CurrencyCode, rateDate: string, sourceDate: string, rate: number): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO exchange_rates (currency, rate_date, source_date, rate, created_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE source_date = VALUES(source_date), rate = VALUES(rate)`,
    [currency, rateDate, sourceDate, rate],
  );
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Runs once per scheduled tick (see lib/scheduler.ts) — fetches today's
// TWD/USD and TWD/CNY rates from TAIFEX and records them under today's
// calendar date. If TAIFEX has nothing new yet (holiday, not-yet-published,
// fetch failure), reuses the most recent successfully stored rate for each
// currency instead of leaving the day blank, but keeps that rate's original
// source_date rather than pretending it's fresh — so a caller inspecting the
// row can tell a fallback happened.
export async function syncExchangeRates(): Promise<void> {
  const today = todayDateString();
  const latest = await fetchLatestTaifexRow();

  const targets: { currency: CurrencyCode; freshRate: number | undefined }[] = [
    { currency: "USD", freshRate: latest?.usdTwd },
    { currency: "CNY", freshRate: latest?.cnyTwd },
  ];

  for (const target of targets) {
    if (latest && target.freshRate !== undefined) {
      await upsertRate(target.currency, today, latest.date, target.freshRate);
      continue;
    }

    const fallback = await getLatestStoredRate(target.currency);
    if (fallback) {
      await upsertRate(target.currency, today, fallback.sourceDate, fallback.rate);
    }
    // No fallback available either (fresh DB, first-ever sync failed): skip
    // — getLatestStoredRate simply returns null and callers show NTD-only
    // until the next successful sync.
  }
}
