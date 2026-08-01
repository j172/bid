import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
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
                    <Link href={`/listings/${bid.listingId}`} className="font-medium text-gold hover:underline">
                      {bid.listingTitle}
                    </Link>
                  </td>
                  <td className={td}>{bid.bidAmount}</td>
                  <td className={`${td} font-semibold`}>{bid.listingCurrentPrice}</td>
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
