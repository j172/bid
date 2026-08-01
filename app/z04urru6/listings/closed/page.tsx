import Link from "next/link";
import {
  CLOSE_REASON_LABELS,
  CLOSED_LISTINGS_PAGE_SIZE,
  listClosedListings,
  type ListClosedListingsOptions,
} from "@/lib/listings";
import SettleModal from "./SettleModal";
import UnsettleButton from "./UnsettleButton";
import BiddersExpand from "./BiddersExpand";
import WinnerExpand from "./WinnerExpand";
import SettlementExpand from "./SettlementExpand";
import RelistModal from "./RelistModal";
import AdminPageIntro from "../../AdminPageIntro";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("zh-TW", { hour12: false });
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(params: SearchParams, overrides: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const key of ["search", "winnerEmail", "status", "sort", "page"]) {
    const value = key in overrides ? overrides[key] : first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export default async function ClosedListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = first(params.search) ?? "";
  const winnerEmail = first(params.winnerEmail) ?? "";
  const status = (first(params.status) as ListClosedListingsOptions["status"] | undefined) ?? "all";
  const sort = (first(params.sort) as ListClosedListingsOptions["sort"] | undefined) ?? "ends_desc";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

  const { listings, total } = await listClosedListings({ search, winnerEmail, status, sort, page });
  const totalPages = Math.max(1, Math.ceil(total / CLOSED_LISTINGS_PAGE_SIZE));
  const exportQuery = buildQuery(params, { page: "" });

  return (
    <main>
      <AdminPageIntro title="已結標商品結算" description="追蹤得標與結算狀態，並支援流標商品快速重新上架。" />

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm" method="GET">
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          商品標題
          <input
            name="search"
            defaultValue={search}
            placeholder="搜尋商品標題"
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          得標者 Email
          <input
            name="winnerEmail"
            defaultValue={winnerEmail}
            placeholder="搜尋得標者 email"
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          交易狀態
          <select
            name="status"
            defaultValue={status}
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          >
            <option value="all">全部</option>
            <option value="settled">已完成交易</option>
            <option value="unsettled">尚未完成</option>
            <option value="no_winner">無人得標</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          排序
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          >
            <option value="ends_desc">結標時間（新→舊）</option>
            <option value="price_desc">成交價（高→低）</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark">
          套用
        </button>
        <a
          href={`/api/admin/listings/closed/export?${exportQuery}`}
          className="rounded-lg border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue hover:bg-brand-chip"
        >
          匯出 CSV
        </a>
      </form>

      {listings.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的商品。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>商品</th>
                <th className={th}>得標者</th>
                <th className={th}>成交價</th>
                <th className={th}>結標時間</th>
                <th className={th}>得標方式</th>
                <th className={th}>出價次數</th>
                <th className={th}>交易狀態</th>
                <th className={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id} className="transition hover:bg-surface-muted/80">
                  <td className={td}>
                    <Link href={`/listings/${listing.id}`} className="font-medium text-gold hover:underline">
                      {listing.title}
                    </Link>
                  </td>
                  <td className={td}>
                    {listing.winnerEmail === null ? (
                      "無人得標"
                    ) : (
                      <WinnerExpand listingId={listing.id} email={listing.winnerEmail} />
                    )}
                  </td>
                  <td className={`${td} font-semibold`}>{listing.finalPrice}</td>
                  <td className={td}>{formatDate(listing.endsAt)}</td>
                  <td className={td}>{listing.closeReason ? CLOSE_REASON_LABELS[listing.closeReason] : "未知"}</td>
                  <td className={td}>
                    <BiddersExpand listingId={listing.id} bidCount={listing.bidCount} />
                  </td>
                  <td className={td}>
                    {listing.winnerEmail === null ? (
                      "—"
                    ) : listing.settled ? (
                      listing.settlementAccount !== null && listing.settlementAmount !== null ? (
                        <SettlementExpand account={listing.settlementAccount} amount={listing.settlementAmount} />
                      ) : (
                        <span className="text-sm text-leading">已完成交易</span>
                      )
                    ) : (
                      <span className="text-sm text-ink-light">尚未完成</span>
                    )}
                  </td>
                  <td className={td}>
                    {listing.winnerEmail === null ? (
                      <RelistModal listingId={listing.id} />
                    ) : listing.settled ? (
                      <UnsettleButton listingId={listing.id} />
                    ) : (
                      <SettleModal
                        listingId={listing.id}
                        finalPrice={listing.finalPrice}
                        previousAccount={listing.settlementAccount}
                        previousAmount={listing.settlementAmount}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2 text-sm shadow-sm">
          {page > 1 && (
            <Link
              href={`/z04urru6/listings/closed?${buildQuery(params, { page: String(page - 1) })}`}
              className="text-gold hover:underline"
            >
              上一頁
            </Link>
          )}
          <span className="text-ink-light">
            第 {page} / {totalPages} 頁（共 {total} 筆）
          </span>
          {page < totalPages && (
            <Link
              href={`/z04urru6/listings/closed?${buildQuery(params, { page: String(page + 1) })}`}
              className="text-gold hover:underline"
            >
              下一頁
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
