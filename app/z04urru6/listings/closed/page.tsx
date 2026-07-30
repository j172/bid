import Link from "next/link";
import { getClosedListings } from "@/lib/listings";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

export default async function ClosedListingsPage() {
  const listings = await getClosedListings();

  return (
    <main>
      <h1 className="text-2xl font-bold">已結標商品結算</h1>

      {listings.length === 0 ? (
        <p className="mt-6 text-ink-light">目前沒有已結標的商品。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>商品</th>
                <th className={th}>得標者</th>
                <th className={th}>成交價</th>
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
                  <td className={td}>{listing.winnerEmail ?? "無人得標"}</td>
                  <td className={`${td} font-semibold`}>{listing.finalPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
