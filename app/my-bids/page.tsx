import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBidHistoryForUser } from "@/lib/listings";
import StatusBadge from "../components/StatusBadge";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

export default async function MyBidsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const bids = await getBidHistoryForUser(user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">我的出價紀錄</h1>

      {bids.length === 0 ? (
        <p className="mt-6 text-ink-light">你還沒有出過價。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>商品</th>
                <th className={th}>我的出價</th>
                <th className={th}>目前價格</th>
                <th className={th}>狀態</th>
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
