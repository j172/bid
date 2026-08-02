import { useTranslations } from "next-intl";

// Translated duplicate of app/components/StatusBadge.tsx — that original
// copy stays in place, untranslated, for the admin backend (see
// app/z04urru6/users/[id]/page.tsx), which sits outside next-intl's
// NextIntlClientProvider entirely (see the ticket that introduced this
// app/[locale]/ tree).
export default function StatusBadge({ status, isLeading }: { status: string; isLeading?: boolean }) {
  const t = useTranslations("statusBadge");

  if (status === "scheduled") {
    return (
      <span className="inline-block rounded-full bg-brand-chip px-2.5 py-0.5 text-xs font-medium text-brand-blue">
        {t("scheduled")}
      </span>
    );
  }

  if (status === "cancelled") {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        {t("cancelled")}
      </span>
    );
  }

  if (status !== "open") {
    return (
      <span className="inline-block rounded-full bg-ended-bg px-2.5 py-0.5 text-xs font-medium text-ended">
        {t("closed")}
      </span>
    );
  }

  if (isLeading === true) {
    return (
      <span className="inline-block rounded-full bg-leading-bg px-2.5 py-0.5 text-xs font-medium text-leading">
        {t("leading")}
      </span>
    );
  }
  if (isLeading === false) {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        {t("outbid")}
      </span>
    );
  }

  return (
    <span className="inline-block rounded-full bg-gold-light px-2.5 py-0.5 text-xs font-medium text-gold-dark">
      {t("bidding")}
    </span>
  );
}
