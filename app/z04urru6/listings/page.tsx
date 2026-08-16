import Link from "next/link";
import { getOpenListingsForAdmin, OPEN_LISTINGS_PAGE_SIZE, type ListOpenListingsForAdminOptions } from "@/lib/listings";
import { formatRemainingZhHant } from "@/lib/format";
import { LISTING_TYPE_LABEL } from "@/lib/listingTypeLabel";
import CancelButton from "./CancelButton";
import EditListingModal from "./EditListingModal";
import EditScheduleModal from "./EditScheduleModal";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";

export const dynamic = "force-dynamic";

const QUERY_KEYS = ["search", "type", "sort", "page"] as const;

export default async function AdminOpenListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = parseFirstParam(params.search) ?? "";
  const type = parseFirstParam(params.type) as ListOpenListingsForAdminOptions["type"] | undefined;
  const sort = (parseFirstParam(params.sort) as ListOpenListingsForAdminOptions["sort"] | undefined) ?? "ends_asc";
  const requestedPage = parsePageParam(params.page);

  const { listings, total } = await getOpenListingsForAdmin({ search, type, sort, page: requestedPage });
  const totalPages = Math.max(1, Math.ceil(total / OPEN_LISTINGS_PAGE_SIZE));
  // 超出範圍的 page 夾回最後一頁，避免分頁列顯示「第 999 / 3 頁」（issue #139 L3）。
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <AdminPageIntro title="開放中商品" description="管理可售商品、調整排序並快速處理下架操作。" />

      <form className={filterFormClass} method="GET">
        <label className={filterLabelClass}>
          商品標題
          <input name="search" defaultValue={search} placeholder="搜尋商品標題" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          商品分類
          <select name="type" defaultValue={type ?? ""} className={filterControlClass}>
            <option value="">全部</option>
            <option value="auction">競標商品</option>
            <option value="fixed_price">一般商品</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          排序
          <select name="sort" defaultValue={sort} className={filterControlClass}>
            <option value="ends_asc">剩餘時間（近→遠）</option>
            <option value="price_desc">價格（高→低）</option>
            <option value="price_asc">價格（低→高）</option>
            <option value="stock_asc">庫存數量（少→多）</option>
            <option value="stock_desc">庫存數量（多→少）</option>
            <option value="created_desc">建立時間（新→舊）</option>
            <option value="created_asc">建立時間（舊→新）</option>
          </select>
        </label>
        <button type="submit" className={filterSubmitClass}>
          套用
        </button>
      </form>

      {listings.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的商品。</p>
      ) : (
        <AdminTable headers={["商品", "分類", "價格", "剩餘時間 / 庫存", ""]}>
          {listings.map((listing) => (
            <AdminTableRow key={listing.id}>
              <AdminTableCell>
                <Link href={`/listings/${listing.id}`} className="font-medium text-interactive-primary hover:underline">
                  {listing.title}
                </Link>
              </AdminTableCell>
              <AdminTableCell>{LISTING_TYPE_LABEL[listing.listingType]}</AdminTableCell>
              <AdminTableCell className="font-semibold">{listing.currentPrice}</AdminTableCell>
              <AdminTableCell>
                {listing.listingType === "fixed_price" ? (
                  listing.stockRemaining === 0 ? (
                    "已售罄"
                  ) : (
                    `剩餘 ${listing.stockRemaining} / ${listing.stockQuantity}`
                  )
                ) : listing.status === "scheduled" && listing.startsAt ? (
                  <span className="text-interactive-primary">尚未開標・距離開標 {formatRemainingZhHant(listing.startsAt).replace("剩餘 ", "")}</span>
                ) : (
                  listing.endsAt && formatRemainingZhHant(listing.endsAt)
                )}
              </AdminTableCell>
              <AdminTableCell className="text-right">
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
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      <AdminPagination
        basePath="/z04urru6/listings"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
      />
    </main>
  );
}
