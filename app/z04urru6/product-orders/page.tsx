import Link from "next/link";
import {
  getAvailableProductOrderStatuses,
  getProductOrdersForAdmin,
  PRODUCT_ORDERS_PAGE_SIZE,
  type ListProductOrdersOptions,
} from "@/lib/productOrders";
import { formatAdminDateTime } from "@/lib/format";
import BuyerExpand from "./BuyerExpand";
import ProductOrderStatusControl from "./ProductOrderStatusControl";
import AdminPageIntro from "../AdminPageIntro";
import AdminPagination from "../components/AdminPagination";
import { parseFirstParam, parsePageParam, type SearchParams } from "../components/searchParams";
import { AdminTable, AdminTableCell, AdminTableRow } from "../components/AdminTable";
import { filterControlClass, filterFormClass, filterLabelClass, filterSubmitClass } from "../components/tableStyles";

export const dynamic = "force-dynamic";

const QUERY_KEYS = ["search", "buyerEmail", "status", "sort", "page"] as const;

// products 專屬訂單管理頁（issue #298）——比照 ../orders/page.tsx（listings
// fixed_price 訂單）的列表＋搜尋＋篩選＋分頁 UX，但狀態欄位換成
// lib/productOrders.ts 的五態狀態機（標記出貨／完成／取消／退款），而不是
// listings 那邊的已結算／未結算二態。刻意獨立於 ../orders/ 之外，避免混淆
// 這兩條各自獨立的訂單流程。
export default async function ProductOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;

  const search = parseFirstParam(params.search) ?? "";
  const buyerEmail = parseFirstParam(params.buyerEmail) ?? "";
  const status = (parseFirstParam(params.status) as ListProductOrdersOptions["status"] | undefined) ?? "all";
  const sort = (parseFirstParam(params.sort) as ListProductOrdersOptions["sort"] | undefined) ?? "created_desc";
  const requestedPage = parsePageParam(params.page);

  const { orders, total } = await getProductOrdersForAdmin({ search, buyerEmail, status, sort, page: requestedPage });
  const totalPages = Math.max(1, Math.ceil(total / PRODUCT_ORDERS_PAGE_SIZE));
  // 超出範圍的 page 夾回最後一頁，避免分頁列顯示「第 999 / 3 頁」（同 ../orders/page.tsx 慣例）。
  const page = Math.min(requestedPage, totalPages);

  return (
    <main>
      <AdminPageIntro title="商品訂單" description="products（獨立商品 CMS）的每一筆線上下單紀錄，與下方「訂單管理」（一般商品／listings）互相獨立。" />

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
          訂單狀態
          <select name="status" defaultValue={status} className={filterControlClass}>
            <option value="all">全部</option>
            <option value="pending">待處理</option>
            <option value="shipped">已出貨</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
            <option value="refunded">已退款</option>
          </select>
        </label>
        <label className={filterLabelClass}>
          排序
          <select name="sort" defaultValue={sort} className={filterControlClass}>
            <option value="created_desc">下單時間（新→舊）</option>
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
        <AdminTable headers={["商品", "買家", "數量", "總金額", "下單時間", "狀態／操作"]}>
          {orders.map((order) => (
            <AdminTableRow key={order.id}>
              <AdminTableCell>
                <Link href={`/products/${order.productId}`} className="font-medium text-interactive-primary hover:underline">
                  {order.productTitle}
                </Link>
              </AdminTableCell>
              <AdminTableCell>
                <BuyerExpand orderId={order.id} email={order.buyerEmail} />
              </AdminTableCell>
              <AdminTableCell>{order.quantity}</AdminTableCell>
              <AdminTableCell className="font-semibold">{order.totalAmount}</AdminTableCell>
              <AdminTableCell>{formatAdminDateTime(order.createdAt)}</AdminTableCell>
              <AdminTableCell>
                <ProductOrderStatusControl
                  orderId={order.id}
                  currentStatus={order.status}
                  availableStatuses={getAvailableProductOrderStatuses(order.status)}
                  trackingNumber={order.trackingNumber}
                />
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </AdminTable>
      )}

      <AdminPagination
        basePath="/z04urru6/product-orders"
        page={page}
        totalPages={totalPages}
        total={total}
        params={params}
        keys={QUERY_KEYS}
      />
    </main>
  );
}
