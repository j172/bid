// Pure currency display logic for issue #45's multi-currency price display —
// no HTTP/DB involved, so directly unit-testable (see currency.test.ts). The
// actual rates come from lib/exchangeRates.ts; this module only knows how to
// pick a display currency for a locale and format a converted amount.

export type DisplayCurrency = "TWD" | "USD" | "CNY";

const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  TWD: "NT$",
  USD: "$",
  CNY: "¥",
};

// zh-TW -> NTD (no conversion needed), zh-CN -> CNY, en -> USD. Anything
// else falls back to TWD, same as this site's other locale-keyed defaults.
export function currencyForLocale(locale: string): DisplayCurrency {
  if (locale === "zh-CN") return "CNY";
  if (locale === "en") return "USD";
  return "TWD";
}

// Converts a TWD amount into `currency` using `rate` (TWD per 1 unit of
// `currency`, matching lib/exchangeRates.ts's StoredExchangeRate.rate),
// rounded to 2 decimal places.
export function convertFromTwd(amountTwd: number, rate: number): number {
  return Math.round((amountTwd / rate) * 100) / 100;
}

function formatWithSymbol(amount: number, currency: DisplayCurrency): string {
  const formatted = currency === "TWD" ? amount.toLocaleString() : amount.toFixed(2);
  return `${CURRENCY_SYMBOLS[currency]}${formatted}`;
}

// The original NTD amount, always shown regardless of display currency —
// every price on this site is stored/settled in NTD (see the unitless
// BIGINT price columns), so this is never omitted (see issue #45).
export function formatNtd(amountTwd: number): string {
  return formatWithSymbol(amountTwd, "TWD");
}

// The "≈ $317.46" secondary approximation — null when no conversion applies
// (TWD display currency, i.e. zh-TW visitors who already see NTD) or no
// rate has been synced yet, so callers can omit the line entirely rather
// than showing a broken/zero conversion.
export function formatConvertedApprox(amountTwd: number, currency: DisplayCurrency, rate: number | null): string | null {
  if (currency === "TWD" || rate === null) {
    return null;
  }
  const converted = convertFromTwd(amountTwd, rate);
  return `≈ ${formatWithSymbol(converted, currency)}`;
}

// Builds the "NT$10,000 (≈ $317.46)" combined string for compact contexts
// (e.g. the listings grid card) where there isn't room for two separate
// lines — see the listing detail page for the two-line layout instead.
export function formatDualPrice(amountTwd: number, currency: DisplayCurrency, rate: number | null): string {
  const approx = formatConvertedApprox(amountTwd, currency, rate);
  return approx ? `${formatNtd(amountTwd)} (${approx})` : formatNtd(amountTwd);
}
