import Link from "next/link";
import { getOrdersForAdmin, ORDERS_PAGE_SIZE, type ListOrdersOptions } from "@/lib/listings";
import { formatAdminDateTime } from "@/lib/format";
import SettlementExpand from "../listings/closed/SettlementExpand";
import BuyerExpand from "./BuyerExpand";
import SettlementModal from "../components/SettlementModal";
import UnsettleButton from "../components/UnsettleButton";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";

export const dynamic = "force-dynamic";

const QUERY_KEYS = ["search", "buyerEmail", "status", "sort", "page"] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = parseFirstParam(params.search) ?? "";
  const buyerEmail = parseFirstParam(params.buyerEmail) ?? "";
  const status = (parseFirstParam(params.status) as ListOrdersOptions["status"] | undefined) ?? "all";
  const sort = (parseFirstParam(params.sort) as ListOrdersOptions["sort"] | undefined) ?? "created_desc";
  const requestedPage = parsePageParam(params.page);

  const { orders, total } = await getOrdersForAdmin({ search, buyerEmail, status, sort, page: requestedPage });
  const totalPages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));
  // 超出範圍的 page 夾回最後一頁，避免分頁列顯示「第 999 / 3 頁」（issue #139 L3）。
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <AdminPageIntro title="訂單管理" description="一般商品（不開放競標）的每一筆購買紀錄。" />

      <form className={filterFormClass} method="GET">
        <label className={filterLabelClass}>
          商品標題
          <input name="search" defaultValue={search} placeholder="搜尋商品標題" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          買家 Email
          <input name="buyerEmail" defaultValue={buyerEmail} placeholder="搜尋買家 email" className={filterControlClass} />
        </label>
        <label className={filterLabelClass}>
          交易狀態
          <select name="status" defaultValue={status} className={filterControlClass}>
            <option value="all">全部</option>
            <option value="settled">已完成交易</option>
            <option value="unsettled">尚未完成</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          排序
          <select name="sort" defaultValue={sort} className={filterControlClass}>
            <option value="created_desc">購買時間（新→舊）</option>
            <option value="amount_desc">金額（高→低）</option>
          </select>
        </label>
        <button type="submit" className={filterSubmitClass}>
          套用
        </button>
      </form>

      {orders.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的訂單。</p>
      ) : (
        <AdminTable headers={["商品", "買家", "數量", "總金額", "購買時間", "交易狀態", "操作"]}>
          {orders.map((order) => (
            <AdminTableRow key={order.id}>
              <AdminTableCell>
                <Link href={`/listings/${order.listingId}`} className="font-medium text-interactive-primary hover:underline">
                  {order.listingTitle}
                </Link>
              </AdminTableCell>
              <AdminTableCell>
                <BuyerExpand orderId={order.id} email={order.buyerEmail} />
              </AdminTableCell>
              <AdminTableCell>{order.quantity}</AdminTableCell>
              <AdminTableCell className="font-semibold">{order.totalAmount}</AdminTableCell>
              <AdminTableCell>{formatAdminDateTime(order.createdAt)}</AdminTableCell>
              <AdminTableCell>
                {order.settled ? (
                  <SettlementExpand
                    account={order.settlementAccount}
                    amount={order.settlementAmount}
                    profileUrl={`/api/admin/orders/${order.id}/buyer`}
                  />
                ) : (
                  <span className="text-sm text-ink-light">尚未完成</span>
                )}
              </AdminTableCell>
              <AdminTableCell>
                {order.settled ? (
                  <UnsettleButton
                    apiPath={`/api/admin/orders/${order.id}/unsettle`}
                    confirmMessage="確定要取消這筆訂單的「已完成交易」標記嗎？"
                  />
                ) : (
                  <SettlementModal
                    entityId={order.id}
                    entityLabel="訂單"
                    apiPath={`/api/admin/orders/${order.id}/settle`}
                    defaultAmount={order.totalAmount}
                    previousAccount={order.settlementAccount}
                    previousAmount={order.settlementAmount}
                  />
                )}
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      <AdminPagination
        basePath="/z04urru6/orders"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
      />
    </main>
  );
}
