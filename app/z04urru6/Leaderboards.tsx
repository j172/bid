import Link from "next/link";
import type { TopBidder, TopCustomer, TopListing } from "@/lib/dashboard";

const cardClass = "rounded-lg border border-border bg-surface p-4 shadow-sm";
const TYPE_LABEL: Record<string, string> = { auction: "拍賣", fixed_price: "一般商品" };

export default function Leaderboards({
  topListings,
  topBidders,
  topCustomers,
}: {
  topListings: TopListing[];
  topBidders: TopBidder[];
  topCustomers: TopCustomer[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className={cardClass}>
        <h3 className="font-semibold">最高成交額商品 Top 5</h3>
        {topListings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-light">目前沒有成交紀錄。</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {topListings.map((listing, index) => (
              <li key={listing.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-ink-light">{index + 1}.</span>
                  <Link href={`/listings/${listing.id}`} className="truncate text-interactive-primary hover:underline">
                    {listing.title}
                  </Link>
                  <span className="flex-shrink-0 text-xs text-ink-light">（{TYPE_LABEL[listing.listingType]}）</span>
                </span>
                <span className="flex-shrink-0 font-semibold">{listing.gmv.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold">最活躍競標者 Top 5</h3>
        {topBidders.length === 0 ? (
          <p className="mt-2 text-sm text-ink-light">目前沒有出價紀錄。</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {topBidders.map((bidder, index) => (
              <li key={bidder.email} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-ink-light">{index + 1}.</span>
                  <span className="truncate">{bidder.email}</span>
                </span>
                <span className="flex-shrink-0 font-semibold">{bidder.bidCount} 次</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold">最佳客戶 Top 5</h3>
        {topCustomers.length === 0 ? (
          <p className="mt-2 text-sm text-ink-light">目前沒有交易紀錄。</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {topCustomers.map((customer, index) => (
              <li key={customer.email} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-ink-light">{index + 1}.</span>
                  <span className="truncate">{customer.email}</span>
                </span>
                <span className="flex-shrink-0 font-semibold">{customer.totalSpend.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
