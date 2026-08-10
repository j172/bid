// The "which badge does this listing get?" decision, shared by the site's
// two StatusBadge components (issue #139 item 6).
//
// There are deliberately two components — app/components/StatusBadge.tsx is
// untranslated because the admin backend sits outside next-intl's
// <NextIntlClientProvider>, while app/[locale]/components/StatusBadge.tsx is
// the translated public one. That split is a real architectural constraint
// and stays. What was duplicated was the branching *below* it: both copies
// re-derived the same status/isLeading/isFixedPrice precedence and both
// carried their own copy of every Tailwind class string, so a new status or
// a colour tweak had to be made twice and could silently drift.
//
// This module owns that decision once and answers with a `key` plus the
// class string; each component maps the key to its own text source.

export type StatusBadgeKey = "scheduled" | "cancelled" | "closed" | "leading" | "outbid" | "onSale" | "bidding";

export interface StatusBadgeVariant {
  /** Message key in the `statusBadge` namespace — also the admin copy's lookup key. */
  key: StatusBadgeKey;
  className: string;
}

const BASE_CLASS = "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium";

const NEUTRAL_CLASS = `${BASE_CLASS} bg-gray-100 text-gray-600`;
const ACCENT_CLASS = `${BASE_CLASS} bg-interactive-primary-subtle text-interactive-primary-active`;

const VARIANTS: Record<StatusBadgeKey, StatusBadgeVariant> = {
  scheduled: { key: "scheduled", className: `${BASE_CLASS} bg-interactive-primary-subtle text-interactive-primary` },
  cancelled: { key: "cancelled", className: NEUTRAL_CLASS },
  closed: { key: "closed", className: `${BASE_CLASS} bg-ended-bg text-ended` },
  leading: { key: "leading", className: `${BASE_CLASS} bg-leading-bg text-leading` },
  outbid: { key: "outbid", className: NEUTRAL_CLASS },
  onSale: { key: "onSale", className: ACCENT_CLASS },
  bidding: { key: "bidding", className: ACCENT_CLASS },
};

/**
 * Resolves a listing's badge.
 *
 * Precedence, unchanged from the two components this replaces: lifecycle
 * status wins first (scheduled / cancelled / anything not 'open' → closed),
 * then — for an open listing only — an explicit leading/outbid stance if the
 * caller passed one, then the listing type.
 *
 * @param isLeading Tri-state on purpose: `undefined` means "this view has no
 *   opinion" (the public grid), which is not the same as `false` ("this
 *   visitor has been outbid").
 * @param isFixedPrice Fixed-price ("一般商品") listings never bid or lead —
 *   an open one is just "on sale" (issue #49), not "bidding".
 */
export function resolveStatusBadgeVariant(
  status: string,
  isLeading?: boolean,
  isFixedPrice?: boolean,
): StatusBadgeVariant {
  if (status === "scheduled") return VARIANTS.scheduled;
  if (status === "cancelled") return VARIANTS.cancelled;
  if (status !== "open") return VARIANTS.closed;

  if (isLeading === true) return VARIANTS.leading;
  if (isLeading === false) return VARIANTS.outbid;

  return isFixedPrice ? VARIANTS.onSale : VARIANTS.bidding;
}
