// Pure currency display logic for issue #45's multi-currency price display —
// no HTTP/DB involved, so directly unit-testable (see currency.test.ts). The
// actual rates come from lib/exchangeRates.ts; this module only knows how to
// pick display currencies for a locale and format converted amounts.

export type DisplayCurrency = "TWD" | "USD" | "EUR" | "CNY";

const CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  TWD: "NT$",
  USD: "$",
  EUR: "€",
  CNY: "¥",
};

// A display currency paired with its latest synced rate (TWD per 1 unit of
// `currency`, or null before the first successful sync) — the shape
// formatConvertedApprox/formatDualPrice take one of per convertible
// currency, per locale (see currencyForLocale).
export interface CurrencyRate {
  currency: DisplayCurrency;
  rate: number | null;
}

// zh-TW -> [] (no conversion needed, prices are already NTD), zh-CN ->
// ["CNY"], en -> ["USD", "EUR"] (issue #154 — English-locale visitors get
// both reference currencies). Anything else falls back to [], same as this
// site's other locale-keyed defaults.
export function currencyForLocale(locale: string): DisplayCurrency[] {
  if (locale === "zh-CN") return ["CNY"];
  if (locale === "en") return ["USD", "EUR"];
  return [];
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

// Non-null (currency, rate) pairs with TWD (never convertible) and missing
// rates (not yet synced) dropped — the shared filtering step behind both
// formatConvertedApprox and formatDualPrice below, so a currency with no
// rate yet is silently omitted rather than producing a broken/zero
// conversion in either format.
function convertibleAmounts(amountTwd: number, currencies: CurrencyRate[]): { currency: DisplayCurrency; amount: number }[] {
  return currencies
    .filter((entry): entry is CurrencyRate & { rate: number } => entry.currency !== "TWD" && entry.rate !== null)
    .map(({ currency, rate }) => ({ currency, amount: convertFromTwd(amountTwd, rate) }));
}

// The "≈ $317.46" secondary approximations, one per convertible currency —
// each currency is only included if it has a synced rate (TWD is never
// convertible, and a currency with no rate yet is silently dropped) so
// callers can omit that line entirely rather than showing a broken/zero
// conversion. An empty `currencies` array (zh-TW) or one where every rate is
// null yields an empty result array, same as today's `null` return.
export function formatConvertedApprox(amountTwd: number, currencies: CurrencyRate[]): string[] {
  return convertibleAmounts(amountTwd, currencies).map(({ currency, amount }) => `≈ ${formatWithSymbol(amount, currency)}`);
}

// Builds the "NT$10,000 (≈ $317.46 / €293.81)" combined string for compact
// contexts (e.g. the listings grid card) where there isn't room for one line
// per currency — see the listing detail page for the one-line-per-currency
// layout instead. A single leading "≈" covers every joined amount (not one
// per currency) per issue #154. With zero convertible currencies this is
// just the NTD amount (no parens); with exactly one, it's byte-for-byte
// identical to the pre-#154 single-currency output.
export function formatDualPrice(amountTwd: number, currencies: CurrencyRate[]): string {
  const amounts = convertibleAmounts(amountTwd, currencies);
  if (amounts.length === 0) return formatNtd(amountTwd);
  const joined = amounts.map(({ currency, amount }) => formatWithSymbol(amount, currency)).join(" / ");
  return `${formatNtd(amountTwd)} (≈ ${joined})`;
}
