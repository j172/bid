import Link from "next/link";
import type { RecentActivity as RecentActivityData } from "@/lib/dashboard";
import { formatAdminDateTime } from "@/lib/format";
import { LISTING_TYPE_LABEL } from "@/lib/listingTypeLabel";

const cardClass = "rounded-lg border border-border bg-surface p-4 shadow-sm";

export default function RecentActivity({ activity }: { activity: RecentActivityData }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className={cardClass}>
        <h3 className="font-semibold">最新註冊會員</h3>
        {activity.newUsers.length === 0 ? (
          <p className="mt-2 text-sm text-ink-light">目前沒有會員。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {activity.newUsers.map((user) => (
              <li key={user.id} className="flex flex-col">
                <Link href={`/z04urru6/users/${user.id}`} className="truncate text-interactive-primary hover:underline">
                  {user.displayName ?? user.email}
                </Link>
                <span className="text-xs text-ink-light">{formatAdminDateTime(user.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold">最新上架商品</h3>
        {activity.newListings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-light">目前沒有商品。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {activity.newListings.map((listing) => (
              <li key={listing.id} className="flex flex-col">
                <span>
                  <Link href={`/listings/${listing.id}`} className="truncate text-interactive-primary hover:underline">
                    {listing.title}
                  </Link>{" "}
                  <span className="text-xs text-ink-light">（{LISTING_TYPE_LABEL[listing.listingType]}）</span>
                </span>
                <span className="text-xs text-ink-light">{formatAdminDateTime(listing.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="font-semibold">最新出價</h3>
        {activity.newBids.length === 0 ? (
          <p className="mt-2 text-sm text-ink-light">目前沒有出價紀錄。</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {activity.newBids.map((bid) => (
              <li key={bid.id} className="flex flex-col">
                <span className="truncate">
                  {bid.email}{" "}
                  <Link href={`/listings/${bid.listingId}`} className="text-interactive-primary hover:underline">
                    {bid.listingTitle}
                  </Link>{" "}
                  <span className="font-semibold">{bid.amount.toLocaleString()}</span>
                </span>
                <span className="text-xs text-ink-light">{formatAdminDateTime(bid.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
