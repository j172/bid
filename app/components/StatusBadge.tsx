import { resolveStatusBadgeVariant, type StatusBadgeKey } from "@/lib/statusBadge";

// Untranslated badge for the admin backend (see app/z04urru6/users/[id]/
// page.tsx), which sits outside next-intl's NextIntlClientProvider entirely.
// Its translated twin is app/[locale]/components/StatusBadge.tsx; both share
// the status → variant decision via lib/statusBadge.ts (issue #139 item 6)
// and differ only in where the label text comes from.
const LABELS: Record<StatusBadgeKey, string> = {
  scheduled: "尚未開標",
  cancelled: "已下架",
  closed: "已結標",
  leading: "目前領先",
  outbid: "已被超越",
  onSale: "販售中",
  bidding: "競標中",
};

export default function StatusBadge({
  status,
  isLeading,
  isFixedPrice,
}: {
  status: string;
  isLeading?: boolean;
  /** Fixed-price ("一般商品") listings never bid/lead — an open one is just "on sale" (issue #49), not "bidding". */
  isFixedPrice?: boolean;
}) {
  const variant = resolveStatusBadgeVariant(status, isLeading, isFixedPrice);
  return <span className={variant.className}>{LABELS[variant.key]}</span>;
}
