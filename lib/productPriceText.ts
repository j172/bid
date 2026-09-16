// Rendering-only formatting for `products.priceText` (see lib/products.ts) —
// that column is deliberately a free-text field (products never enter the
// transactional/bidding flow, so there is no numeric validation on write;
// see lib/productValidation.ts and the `products` table comment in
// db/init.sql). This helper only decides how a stored value is *displayed*
// on the public site: an admin who typed a bare number gets thousand
// separators and an "NT$" prefix for readability, while anything else
// (already-prefixed amounts, "電洽", "面議", decimals, commas, ranges, ...)
// is rendered byte-for-byte as stored, since we can't safely assume its
// shape.
//
// Deliberately NOT built on lib/currency.ts: that module's
// formatDualPrice/currencyForLocale exist to convert a known numeric TWD
// amount into multiple *display currencies* for the listings/bidding flow.
// products.priceText is free text with no guaranteed numeric meaning and no
// cross-currency requirement — NT$ is always the prefix regardless of
// locale; only the thousand-separator grouping should follow the current
// locale, via Intl.NumberFormat.
const ALL_DIGITS = /^[0-9]+$/;

export function formatProductPriceText(priceText: string, locale: string): string {
  const trimmed = priceText.trim();
  if (trimmed.length === 0 || !ALL_DIGITS.test(trimmed)) {
    // Not a strict "digits only" string (includes empty/whitespace-only) —
    // return completely unchanged, preserving the original value exactly as
    // stored (not even trimmed).
    return priceText;
  }

  const amount = Number(trimmed);
  return `NT$${new Intl.NumberFormat(locale).format(amount)}`;
}
