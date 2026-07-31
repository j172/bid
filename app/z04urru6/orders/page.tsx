import Link from "next/link";
import { getOrdersForAdmin, ORDERS_PAGE_SIZE, type ListOrdersOptions } from "@/lib/listings";
import SettlementExpand from "../listings/closed/SettlementExpand";
import BuyerExpand from "./BuyerExpand";
import OrderSettleModal from "./OrderSettleModal";
import OrderUnsettleButton from "./OrderUnsettleButton";

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
  for (const key of ["search", "buyerEmail", "status", "sort", "page"]) {
    const value = key in overrides ? overrides[key] : first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = first(params.search) ?? "";
  const buyerEmail = first(params.buyerEmail) ?? "";
  const status = (first(params.status) as ListOrdersOptions["status"] | undefined) ?? "all";
  const sort = (first(params.sort) as ListOrdersOptions["sort"] | undefined) ?? "created_desc";
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

  const { orders, total } = await getOrdersForAdmin({ search, buyerEmail, status, sort, page });
  const totalPages = Math.max(1, Math.ceil(total / ORDERS_PAGE_SIZE));

  return (
    <main>
      <h1 className="text-2xl font-bold">訂單管理</h1>
      <p className="mt-2 text-sm text-ink-light">一般商品（不開放競標）的每一筆購買紀錄。</p>

      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4" method="GET">
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
          買家 Email
          <input
            name="buyerEmail"
            defaultValue={buyerEmail}
            placeholder="搜尋買家 email"
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
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          排序
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-border px-2 py-1 text-sm focus:border-gold focus:outline-none"
          >
            <option value="created_desc">購買時間（新→舊）</option>
            <option value="amount_desc">金額（高→低）</option>
          </select>
        </label>
        <button type="submit" className="rounded-md bg-header px-4 py-1.5 text-sm font-medium text-white hover:opacity-90">
          套用
        </button>
      </form>

      {orders.length === 0 ? (
        <p className="mt-6 text-ink-light">找不到符合條件的訂單。</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
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
                <tr key={order.id}>
                  <td className={td}>
                    <Link href={`/listings/${order.listingId}`} className="font-medium text-gold hover:underline">
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
                      order.settlementAccount !== null && order.settlementAmount !== null ? (
                        <SettlementExpand account={order.settlementAccount} amount={order.settlementAmount} />
                      ) : (
                        <span className="text-sm text-leading">已完成交易</span>
                      )
                    ) : (
                      <span className="text-sm text-ink-light">尚未完成</span>
                    )}
                  </td>
                  <td className={td}>
                    {order.settled ? (
                      <OrderUnsettleButton orderId={order.id} />
                    ) : (
                      <OrderSettleModal
                        orderId={order.id}
                        totalAmount={order.totalAmount}
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/z04urru6/orders?${buildQuery(params, { page: String(page - 1) })}`} className="text-gold hover:underline">
              上一頁
            </Link>
          )}
          <span className="text-ink-light">
            第 {page} / {totalPages} 頁（共 {total} 筆）
          </span>
          {page < totalPages && (
            <Link href={`/z04urru6/orders?${buildQuery(params, { page: String(page + 1) })}`} className="text-gold hover:underline">
              下一頁
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
