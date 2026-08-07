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

// issue #55: the TAIFEX host has occasionally been flaky under this
// process's memory pressure (see lib/convertPhotoToWebp.ts's unrelated WASM
// OOM issue), so a single failed attempt shouldn't immediately give up for
// the day — retry a few times with a short delay before treating it as a
// real failure.
//
// issue #81: production evidence (30 host-triggered process restarts over
// 5.5 days, one every ~4.4h) shows the boot-time startup sync in
// scheduler.ts is currently the *only* sync path that ever actually runs on
// this host — the 08:10 Asia/Taipei cron tick has never once logged a
// failure, but the table is still empty, meaning the process doesn't
// reliably stay alive long enough to see 08:10 at all. That makes the few
// seconds right after boot this app's one real chance per restart, so it's
// worth spending more of them here: more attempts, spaced further apart, to
// ride out whatever makes the host's networking briefly unreliable
// immediately post-restart (see startScheduler()'s own boot-delay for the
// other half of that mitigation).
const TAIFEX_FETCH_MAX_ATTEMPTS = 5;
const TAIFEX_FETCH_RETRY_DELAY_MS = 5000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Performs the network fetch (with retries) and returns the raw CSV text.
// Throws the last attempt's error once every attempt has been exhausted —
// each failed attempt is logged as it happens (issue #55: previously every
// error here was swallowed silently, making the failure impossible to
// diagnose from server logs).
async function fetchTaifexCsvText(): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= TAIFEX_FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(TAIFEX_URL);
      if (!response.ok) {
        throw new Error(`TAIFEX responded with HTTP ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // issue #81: production pm2 logs for every one of 8 observed
      // startup-sync failures showed nothing but `TypeError: fetch failed`
      // plus a stack trace pointing at undici internals — never the actual
      // reason. Node's undici-backed fetch() wraps the real lower-level
      // network error (ENOTFOUND/ETIMEDOUT/ECONNREFUSED/...) in `error.cause`
      // rather than `error.message`, and errno/code live as non-standard
      // properties on that cause (Node's system errors, not part of the
      // Error type — hence the casts below). Folding all of that into the
      // log line itself means a stuck sync can be diagnosed straight from
      // `pm2 logs`, without SSHing in to reproduce it by hand.
      const name = error instanceof Error ? error.name : undefined;
      const code = (error as NodeJS.ErrnoException)?.code;
      const errno = (error as NodeJS.ErrnoException)?.errno;
      const cause = error instanceof Error ? error.cause : undefined;
      const causeDetail =
        cause instanceof Error
          ? ` cause=${cause.name}: ${cause.message}` +
            ((cause as NodeJS.ErrnoException).code ? ` cause.code=${(cause as NodeJS.ErrnoException).code}` : "") +
            ((cause as NodeJS.ErrnoException).errno !== undefined
              ? ` cause.errno=${(cause as NodeJS.ErrnoException).errno}`
              : "")
          : cause !== undefined
            ? ` cause=${String(cause)}`
            : "";
      console.error(
        `[exchangeRates] TAIFEX fetch attempt ${attempt}/${TAIFEX_FETCH_MAX_ATTEMPTS} failed: ${name ?? "Error"}: ${message}` +
          (code ? ` code=${code}` : "") +
          (errno !== undefined ? ` errno=${errno}` : "") +
          causeDetail,
        error,
      );
      if (attempt < TAIFEX_FETCH_MAX_ATTEMPTS) {
        await delay(TAIFEX_FETCH_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("TAIFEX fetch failed after retries", { cause: lastError });
}

// Fetches the TAIFEX feed and returns its most recent row (the feed is
// already oldest-first for the current month, so the last row is the
// latest published trading day) — or null once all retries are exhausted or
// the response can't be parsed into any rows, in which case
// syncExchangeRates falls back to the last successfully stored rate instead.
// Every failed attempt is logged before this returns null, so a real outage
// is always visible in server logs (issue #55).
export async function fetchLatestTaifexRow(): Promise<TaifexRow | null> {
  let text: string;
  try {
    text = await fetchTaifexCsvText();
  } catch {
    // Already logged per-attempt inside fetchTaifexCsvText.
    return null;
  }

  const rows = parseTaifexCsv(text);
  return rows.length > 0 ? rows[rows.length - 1] : null;
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

export interface SyncExchangeRatesResult {
  /** Whether this run got a fresh row from TAIFEX (vs. relying on fallback). */
  fetchedFresh: boolean;
  /** Currencies that ended up written to the table this run, fresh or fallback. */
  updated: { currency: CurrencyCode; rate: number; sourceDate: string; usedFallback: boolean }[];
  /** Currencies with neither a fresh TAIFEX row nor any previously stored rate. */
  failed: CurrencyCode[];
}

// issue #55: previously a currency with no fresh row *and* no fallback was
// silently skipped, so a caller (scheduler.ts, the admin manual-sync route)
// had no way to know the sync had actually failed. Thrown by
// syncExchangeRates() so both call sites' existing try/catch actually fires.
export class SyncExchangeRatesError extends Error {
  readonly result: SyncExchangeRatesResult;

  constructor(result: SyncExchangeRatesResult) {
    super(`Exchange rate sync failed for: ${result.failed.join(", ")} (no TAIFEX row and no stored fallback)`);
    this.name = "SyncExchangeRatesError";
    this.result = result;
  }
}

// Runs once per scheduled tick (see lib/scheduler.ts) — fetches today's
// TWD/USD and TWD/CNY rates from TAIFEX and records them under today's
// calendar date. If TAIFEX has nothing new yet (holiday, not-yet-published,
// fetch failure), reuses the most recent successfully stored rate for each
// currency instead of leaving the day blank, but keeps that rate's original
// source_date rather than pretending it's fresh — so a caller inspecting the
// row can tell a fallback happened.
//
// If a currency has neither a fresh row nor any fallback to reuse (e.g. a
// fresh DB whose very first sync fails), this throws a SyncExchangeRatesError
// carrying the partial result instead of silently doing nothing — see issue
// #55: without this, a total failure never surfaced anywhere.
export async function syncExchangeRates(): Promise<SyncExchangeRatesResult> {
  const today = todayDateString();
  const latest = await fetchLatestTaifexRow();

  const targets: { currency: CurrencyCode; freshRate: number | undefined }[] = [
    { currency: "USD", freshRate: latest?.usdTwd },
    { currency: "CNY", freshRate: latest?.cnyTwd },
  ];

  const updated: SyncExchangeRatesResult["updated"] = [];
  const failed: CurrencyCode[] = [];

  for (const target of targets) {
    if (latest && target.freshRate !== undefined) {
      await upsertRate(target.currency, today, latest.date, target.freshRate);
      updated.push({ currency: target.currency, rate: target.freshRate, sourceDate: latest.date, usedFallback: false });
      continue;
    }

    const fallback = await getLatestStoredRate(target.currency);
    if (fallback) {
      await upsertRate(target.currency, today, fallback.sourceDate, fallback.rate);
      updated.push({ currency: target.currency, rate: fallback.rate, sourceDate: fallback.sourceDate, usedFallback: true });
      continue;
    }

    // No fallback available either (fresh DB, first-ever sync failed).
    failed.push(target.currency);
  }

  const result: SyncExchangeRatesResult = { fetchedFresh: latest !== null, updated, failed };
  if (failed.length > 0) {
    throw new SyncExchangeRatesError(result);
  }
  return result;
}
