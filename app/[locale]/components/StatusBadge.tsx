import { useTranslations } from "next-intl";
import { resolveStatusBadgeVariant } from "@/lib/statusBadge";

// Translated duplicate of app/components/StatusBadge.tsx — that original
// copy stays in place, untranslated, for the admin backend (see
// app/z04urru6/users/[id]/page.tsx), which sits outside next-intl's
// NextIntlClientProvider entirely (see the ticket that introduced this
// app/[locale]/ tree).
//
// Only the label lookup differs between the two: the status → variant
// decision itself lives in lib/statusBadge.ts (issue #139 item 6), and the
// variant's `key` doubles as the `statusBadge` message key.
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
  const t = useTranslations("statusBadge");
  const variant = resolveStatusBadgeVariant(status, isLeading, isFixedPrice);

  return <span className={variant.className}>{t(variant.key)}</span>;
}
