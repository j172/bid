import Link from "next/link";
import { getOrdersForAdmin, ORDERS_PAGE_SIZE, type ListOrdersOptions } from "@/lib/listings";
import SettlementExpand from "../listings/closed/SettlementExpand";
import BuyerExpand from "./BuyerExpand";
import SettleModal from "../components/SettleModal";
import OrderUnsettleButton from "./OrderUnsettleButton";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import {
  filterControlClass,
  filterFormClass,
  filterLabelClass,
  filterSubmitClass,
  tableRowClass,
  tableWrapperClass,
  td,
  th,
} from "../components/tableStyles";

export const dynamic = "force-dynamic";

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("zh-TW", { hour12: false });
}

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
        <div className={tableWrapperClass}>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>商品</th>
                <th className={th}>買家</th>
                <th className={th}>數量</th>
                <th className={th}>總金額</th>
                <th className={th}>購買時間</th>
                <th className={th}>交易狀態</th>
                <th className={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className={tableRowClass}>
                  <td className={td}>
                    <Link href={`/listings/${order.listingId}`} className="font-medium text-interactive-primary hover:underline">
                      {order.listingTitle}
                    </Link>
                  </td>
                  <td className={td}>
                    <BuyerExpand orderId={order.id} email={order.buyerEmail} />
                  </td>
                  <td className={td}>{order.quantity}</td>
                  <td className={`${td} font-semibold`}>{order.totalAmount}</td>
                  <td className={td}>{formatDate(order.createdAt)}</td>
                  <td className={td}>
                    {order.settled ? (
                      <SettlementExpand
                        account={order.settlementAccount}
                        amount={order.settlementAmount}
                        profileUrl={`/api/admin/orders/${order.id}/buyer`}
                      />
                    ) : (
                      <span className="text-sm text-ink-light">尚未完成</span>
                    )}
                  </td>
                  <td className={td}>
                    {order.settled ? (
                      <OrderUnsettleButton orderId={order.id} />
                    ) : (
                      <SettleModal
                        endpoint={`/api/admin/orders/${order.id}/settle`}
                        defaultAmount={order.totalAmount}
                        previousAccount={order.settlementAccount}
                        previousAmount={order.settlementAmount}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
