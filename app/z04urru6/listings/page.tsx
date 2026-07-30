import Link from "next/link";
import { getOpenListingsForAdmin } from "@/lib/listings";
import { formatRemaining } from "@/lib/format";
import CancelButton from "./CancelButton";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

export default async function AdminOpenListingsPage() {
  const listings = await getOpenListingsForAdmin();

  return (
    <main>
      <h1 className="text-2xl font-bold">開放中商品</h1>

      {listings.length === 0 ? (
        <p className="mt-6 text-ink-light">目前沒有開放中的商品。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>商品</th>
                <th className={th}>目前價格</th>
                <th className={th}>剩餘時間</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td className={td}>
                    <Link href={`/listings/${listing.id}`} className="font-medium text-gold hover:underline">
                      {listing.title}
                    </Link>
                  </td>
                  <td className={`${td} font-semibold`}>{listing.currentPrice}</td>
                  <td className={td}>{formatRemaining(listing.endsAt)}</td>
                  <td className={`${td} text-right`}>
                    {listing.hasBids ? (
                      <span className="text-xs text-ink-light">已有出價，無法下架</span>
                    ) : (
                      <CancelButton listingId={listing.id} />
                    )}
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
