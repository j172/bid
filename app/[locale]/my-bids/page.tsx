import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { currencyForLocale, formatDualPrice } from "@/lib/currency";
import { getLatestStoredRate } from "@/lib/exchangeRates";
import { getBidHistoryForUser } from "@/lib/listings";
import { Link, redirect } from "@/i18n/navigation";
import StatusBadge from "../components/StatusBadge";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

export default async function MyBidsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return redirect({ href: "/login", locale: await getLocale() });
  }

  const bids = await getBidHistoryForUser(user.id);
  const t = await getTranslations("myBids");

  // Reference-only currency conversion (issue #45) — see the listing detail
  // page's equivalent comment; this page is public-facing (though
  // login-gated), unlike the admin backend which stays pure NTD.
  const locale = await getLocale();
  const displayCurrency = currencyForLocale(locale);
  const displayRate = displayCurrency === "TWD" ? null : await getLatestStoredRate(displayCurrency);
  const rateValue = displayRate?.rate ?? null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {bids.length === 0 ? (
        <p className="mt-6 text-ink-light">{t("noBids")}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>{t("product")}</th>
                <th className={th}>{t("myBid")}</th>
                <th className={th}>{t("currentPrice")}</th>
                <th className={th}>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid, index) => (
                <tr key={index}>
                  <td className={td}>
                    <Link href={`/listings/${bid.listingId}`} className="font-medium text-interactive-primary hover:underline">
                      {bid.listingTitle}
                    </Link>
                  </td>
                  <td className={td}>{formatDualPrice(bid.bidAmount, displayCurrency, rateValue)}</td>
                  <td className={`${td} font-semibold`}>
                    {formatDualPrice(bid.listingCurrentPrice, displayCurrency, rateValue)}
                  </td>
                  <td className={td}>
                    <StatusBadge status={bid.listingStatus} isLeading={bid.isLeading} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
