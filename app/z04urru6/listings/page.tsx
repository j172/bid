import Link from "next/link";
import { getOpenListingsForAdmin, OPEN_LISTINGS_PAGE_SIZE, type ListOpenListingsForAdminOptions } from "@/lib/listings";
import { formatRemainingZhHant } from "@/lib/format";
import CancelButton from "./CancelButton";
import EditListingModal from "./EditListingModal";
import EditScheduleModal from "./EditScheduleModal";
import AdminPageIntro from "../AdminPageIntro";

export const dynamic = "force-dynamic";

const th = "border-b border-border px-4 py-3 text-left text-sm font-semibold text-ink-light";
const td = "border-b border-border px-4 py-3 text-sm";

const TYPE_LABEL: Record<string, string> = { auction: "競標商品", fixed_price: "一般商品" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(params: SearchParams, overrides: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const key of ["search", "type", "sort", "page"]) {
    const value = key in overrides ? overrides[key] : first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export default async function AdminOpenListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = first(params.search) ?? "";
  const type = first(params.type) as ListOpenListingsForAdminOptions["type"] | undefined;
  const sort = (first(params.sort) as ListOpenListingsForAdminOptions["sort"] | undefined) ?? "ends_asc";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

  const { listings, total } = await getOpenListingsForAdmin({ search, type, sort, page });
  const totalPages = Math.max(1, Math.ceil(total / OPEN_LISTINGS_PAGE_SIZE));

  return (
    <main>
      <AdminPageIntro title="開放中商品" description="管理可售商品、調整排序並快速處理下架操作。" />

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
          商品分類
          <select
            name="type"
            defaultValue={type ?? ""}
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          >
            <option value="">全部</option>
            <option value="auction">競標商品</option>
            <option value="fixed_price">一般商品</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          排序
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          >
            <option value="ends_asc">剩餘時間（近→遠）</option>
            <option value="price_desc">價格（高→低）</option>
            <option value="price_asc">價格（低→高）</option>
            <option value="stock_asc">庫存數量（少→多）</option>
            <option value="stock_desc">庫存數量（多→少）</option>
            <option value="created_desc">建立時間（新→舊）</option>
            <option value="created_asc">建立時間（舊→新）</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark">
          套用
        </button>
      </form>

      {listings.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的商品。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>商品</th>
                <th className={th}>分類</th>
                <th className={th}>價格</th>
                <th className={th}>剩餘時間 / 庫存</th>
                <th className={th}></th>
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
                  <td className={td}>{TYPE_LABEL[listing.listingType]}</td>
                  <td className={`${td} font-semibold`}>{listing.currentPrice}</td>
                  <td className={td}>
                    {listing.listingType === "fixed_price" ? (
                      listing.stockRemaining === 0 ? (
                        "已售罄"
                      ) : (
                        `剩餘 ${listing.stockRemaining} / ${listing.stockQuantity}`
                      )
                    ) : listing.status === "scheduled" && listing.startsAt ? (
                      <span className="text-brand-blue">尚未開標・距離開標 {formatRemainingZhHant(listing.startsAt).replace("剩餘 ", "")}</span>
                    ) : (
                      listing.endsAt && formatRemainingZhHant(listing.endsAt)
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      {listing.listingType === "fixed_price" && <EditListingModal listingId={listing.id} />}
                      {listing.listingType === "auction" && listing.status === "scheduled" && listing.startsAt && (
                        <EditScheduleModal listingId={listing.id} startsAt={listing.startsAt} />
                      )}
                      {listing.canCancel ? (
                        <CancelButton listingId={listing.id} />
                      ) : (
                        <span className="text-xs text-ink-light">已有出價，無法下架</span>
                      )}
                    </div>
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
            <Link href={`/z04urru6/listings?${buildQuery(params, { page: String(page - 1) })}`} className="text-gold hover:underline">
              上一頁
            </Link>
          )}
          <span className="text-ink-light">
            第 {page} / {totalPages} 頁（共 {total} 筆）
          </span>
          {page < totalPages && (
            <Link href={`/z04urru6/listings?${buildQuery(params, { page: String(page + 1) })}`} className="text-gold hover:underline">
              下一頁
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
