import Link from "next/link";
import {
  CLOSE_REASON_LABELS,
  CLOSED_LISTINGS_PAGE_SIZE,
  listClosedListings,
  type ListClosedListingsOptions,
} from "@/lib/listings";
import { formatAdminDateTime } from "@/lib/format";
import SettlementModal from "../../components/SettlementModal";
import UnsettleButton from "../../components/UnsettleButton";
import BiddersExpand from "./BiddersExpand";
import WinnerExpand from "./WinnerExpand";
import SettlementExpand from "./SettlementExpand";
import RelistModal from "./RelistModal";
import AdminPageIntro from "../../AdminPageIntro";
import AdminPagination from "../../components/AdminPagination";
import { buildQueryString, parseFirstParam, parsePageParam, type SearchParams } from "../../components/searchParams";
import { AdminTable, AdminTableCell, AdminTableRow } from "../../components/AdminTable";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../../components/tableStyles";

export const dynamic = "force-dynamic";

const QUERY_KEYS = ["search", "winnerEmail", "status", "sort", "page"] as const;

export default async function ClosedListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = parseFirstParam(params.search) ?? "";
  const winnerEmail = parseFirstParam(params.winnerEmail) ?? "";
  const status = (parseFirstParam(params.status) as ListClosedListingsOptions["status"] | undefined) ?? "all";
  const sort = (parseFirstParam(params.sort) as ListClosedListingsOptions["sort"] | undefined) ?? "ends_desc";
  const requestedPage = parsePageParam(params.page);

  const { listings, total } = await listClosedListings({ search, winnerEmail, status, sort, page: requestedPage });
  const totalPages = Math.max(1, Math.ceil(total / CLOSED_LISTINGS_PAGE_SIZE));
  // 超出範圍的 page 夾回最後一頁，避免分頁列顯示「第 999 / 3 頁」（issue #139 L3）。
  const page = Math.min(requestedPage, totalPages);
  // 匯出沿用目前的篩選條件，但不分頁（page 給空字串會被 buildQueryString 略過）。
  const exportQuery = buildQueryString(params, QUERY_KEYS, { page: "" });

  return (
    <main>
      <AdminPageIntro title="已結標商品結算" description="追蹤得標與結算狀態，並支援流標商品快速重新上架。" />

      <form className={filterFormClass} method="GET">
        <label className={filterLabelClass}>
          商品標題
          <input name="search" defaultValue={search} placeholder="搜尋商品標題" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          得標者 Email
          <input name="winnerEmail" defaultValue={winnerEmail} placeholder="搜尋得標者 email" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          交易狀態
          <select name="status" defaultValue={status} className={filterControlClass}>
            <option value="all">全部</option>
            <option value="settled">已完成交易</option>
            <option value="unsettled">尚未完成</option>
            <option value="no_winner">無人得標</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          排序
          <select name="sort" defaultValue={sort} className={filterControlClass}>
            <option value="ends_desc">結標時間（新→舊）</option>
            <option value="price_desc">成交價（高→低）</option>
          </select>
        </label>
        <button type="submit" className={filterSubmitClass}>
          套用
        </button>
        <a
          href={`/api/admin/listings/closed/export?${exportQuery}`}
          className="rounded-lg border border-interactive-primary px-4 py-2 text-sm font-medium text-interactive-primary hover:bg-interactive-primary-subtle"
        >
          匯出 CSV
        </a>
      </form>

      {listings.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的商品。</p>
      ) : (
        <AdminTable headers={["商品", "得標者", "成交價", "結標時間", "得標方式", "出價次數", "交易狀態", "操作"]}>
          {listings.map((listing) => (
            <AdminTableRow key={listing.id}>
              <AdminTableCell>
                <Link href={`/listings/${listing.id}`} className="font-medium text-interactive-primary hover:underline">
                  {listing.title}
                </Link>
              </AdminTableCell>
              <AdminTableCell>
                {listing.winnerEmail === null ? (
                  "無人得標"
                ) : (
                  <WinnerExpand
                    listingId={listing.id}
                    email={listing.winnerEmail}
                    winnerNotifiedAt={listing.winnerNotifiedAt}
                  />
                )}
              </AdminTableCell>
              <AdminTableCell className="font-semibold">{listing.finalPrice}</AdminTableCell>
              <AdminTableCell>{formatAdminDateTime(listing.endsAt)}</AdminTableCell>
              <AdminTableCell>{listing.closeReason ? CLOSE_REASON_LABELS[listing.closeReason] : "未知"}</AdminTableCell>
              <AdminTableCell>
                <BiddersExpand listingId={listing.id} bidCount={listing.bidCount} />
              </AdminTableCell>
              <AdminTableCell>
                {listing.winnerEmail === null ? (
                  "—"
                ) : listing.settled ? (
                  <SettlementExpand
                    account={listing.settlementAccount}
                    amount={listing.settlementAmount}
                    profileUrl={`/api/admin/listings/${listing.id}/winner`}
                  />
                ) : (
                  <span className="text-sm text-ink-light">尚未完成</span>
                )}
              </AdminTableCell>
              <AdminTableCell>
                {listing.winnerEmail === null ? (
                  <RelistModal listingId={listing.id} />
                ) : listing.settled ? (
                  <UnsettleButton
                    apiPath={`/api/admin/listings/${listing.id}/unsettle`}
                    confirmMessage="確定要取消這筆交易的「已完成交易」標記嗎？"
                  />
                ) : (
                  <SettlementModal
                    entityId={listing.id}
                    entityLabel="商品"
                    apiPath={`/api/admin/listings/${listing.id}/settle`}
                    defaultAmount={listing.finalPrice}
                    previousAccount={listing.settlementAccount}
                    previousAmount={listing.settlementAmount}
                  />
                )}
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      <AdminPagination
        basePath="/z04urru6/listings/closed"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
      />
    </main>
  );
}
