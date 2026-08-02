import Link from "next/link";
import type { PendingActionItems } from "@/lib/dashboard";
import { formatRemainingZhHant } from "@/lib/format";

const cardClass = "rounded-lg border border-border bg-surface p-4 shadow-sm";
const emptyClass = "text-sm text-ink-light";

export default function PendingActions({ items }: { items: PendingActionItems }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className={cardClass}>
        <p className="text-sm text-ink-light">尚未結算的交易</p>
        <p className="mt-1 text-2xl font-bold text-ended">{items.unsettledCount}</p>
        <div className="mt-2 flex flex-col gap-1 text-xs">
          <Link href="/z04urru6/listings/closed?status=unsettled" className="text-interactive-primary hover:underline">
            查看拍賣結算 →
          </Link>
          <Link href="/z04urru6/orders?status=unsettled" className="text-interactive-primary hover:underline">
            查看訂單結算 →
          </Link>
        </div>
      </div>

      <div className={cardClass}>
        <p className="text-sm text-ink-light">24 小時內即將結標</p>
        <p className="mt-1 text-2xl font-bold text-interactive-primary">{items.endingSoon.length}</p>
        {items.endingSoon.length === 0 ? (
          <p className={`mt-2 ${emptyClass}`}>目前沒有即將結標的商品。</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {items.endingSoon.slice(0, 5).map((listing) => (
              <li key={listing.id}>
                <Link href={`/listings/${listing.id}`} className="text-interactive-primary hover:underline">
                  {listing.title}
                </Link>{" "}
                <span className="text-ink-light">{formatRemainingZhHant(listing.endsAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cardClass}>
        <p className="text-sm text-ink-light">庫存不足的一般商品</p>
        <p className="mt-1 text-2xl font-bold text-ended">{items.lowStock.length}</p>
        {items.lowStock.length === 0 ? (
          <p className={`mt-2 ${emptyClass}`}>目前沒有庫存不足的商品。</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {items.lowStock.slice(0, 5).map((listing) => (
              <li key={listing.id}>
                <Link href={`/z04urru6/listings`} className="text-interactive-primary hover:underline">
                  {listing.title}
                </Link>{" "}
                <span className="text-ink-light">
                  {listing.stockRemaining === 0 ? "已售罄" : `剩餘 ${listing.stockRemaining} 件`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cardClass}>
        <p className="text-sm text-ink-light">無人得標（可重新上架）</p>
        <p className="mt-1 text-2xl font-bold text-ink">{items.noWinner.length}</p>
        {items.noWinner.length === 0 ? (
          <p className={`mt-2 ${emptyClass}`}>目前沒有流標的商品。</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-xs">
            {items.noWinner.slice(0, 5).map((listing) => (
              <li key={listing.id}>
                <Link href="/z04urru6/listings/closed?status=no_winner" className="text-interactive-primary hover:underline">
                  {listing.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
