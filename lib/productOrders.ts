// Order flow for `products` (issue #298) — a close mirror of `listings`'
// fixed_price purchase flow (see lib/listings.ts's purchaseListing /
// getOrdersForAdmin) but deliberately its OWN table (`product_orders`) and
// its OWN richer order-status state machine, entirely independent of
// listings' `purchases`/settlement mechanism. Never touches listings'
// tables/routes/UI — see this ticket's explicit scope note.
//
// Why a separate status enum instead of listings' binary settled/unsettled:
// products never had any transactional history before this ticket, so there
// is no existing behavior to preserve, and the interview behind #298 asked
// for a slightly richer shape (pending → shipped → completed, with
// cancelled/refunded reachable from any non-terminal state) specifically for
// products. Retrofitting this onto listings' `purchases` is explicitly out
// of scope.

import { getDb } from "@/lib/db";
import { buildKeywordSearch } from "@/lib/search";
import { paginate } from "@/lib/pagination";
import type { ErrorCode } from "@/lib/errorCodes";
import { notifyProductOrderConfirmed } from "@/lib/notifications";

export type ProductOrderStatus = "pending" | "shipped" | "completed" | "cancelled" | "refunded";

// pending -> shipped -> completed is the main line; cancelled/refunded are
// reachable from any non-terminal state (pending or shipped). completed/
// cancelled/refunded are terminal — no further transitions out of them.
// Kept intentionally this small per the issue's own "don't over-build the
// state machine" instruction.
const PRODUCT_ORDER_TRANSITIONS: Record<ProductOrderStatus, ProductOrderStatus[]> = {
  pending: ["shipped", "cancelled", "refunded"],
  shipped: ["completed", "cancelled", "refunded"],
  completed: [],
  cancelled: [],
  refunded: [],
};

export const PRODUCT_ORDER_TERMINAL_STATUSES: ProductOrderStatus[] = ["completed", "cancelled", "refunded"];

export function isProductOrderStatusTerminal(status: ProductOrderStatus): boolean {
  return PRODUCT_ORDER_TERMINAL_STATUSES.includes(status);
}

/** Pure state-machine check — no HTTP/DB, directly unit-testable. */
export function canTransitionProductOrderStatus(from: ProductOrderStatus, to: ProductOrderStatus): boolean {
  return PRODUCT_ORDER_TRANSITIONS[from].includes(to);
}

// Powers the admin product-orders page's status-change buttons — computed
// server-side (this whole module touches lib/db, so it can only run in a
// server component/route, never imported by the "use client"
// ProductOrderStatusControl directly) and passed down as a prop.
export function getAvailableProductOrderStatuses(from: ProductOrderStatus): ProductOrderStatus[] {
  return PRODUCT_ORDER_TRANSITIONS[from];
}

export type ProductOrderStatusTransitionResult = { ok: true } | { ok: false; error: string };

const STATUS_LABELS: Record<ProductOrderStatus, string> = {
  pending: "待處理",
  shipped: "已出貨",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款",
};

// Admin-only (hardcoded zh-TW error text, same convention as
// lib/settlement.ts/lib/listingValidation.ts) — validates a requested status
// change before it's written.
export function resolveProductOrderStatusTransition(
  from: ProductOrderStatus,
  to: ProductOrderStatus,
): ProductOrderStatusTransitionResult {
  if (!canTransitionProductOrderStatus(from, to)) {
    return {
      ok: false,
      error: `無法將訂單狀態從「${STATUS_LABELS[from]}」變更為「${STATUS_LABELS[to]}」`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Purchase (buy-flow) domain logic — mirrors lib/purchase.ts's
// resolvePurchase, extended with the two guards specific to products: an
// inactive (下架) product can never be bought online (same "gone from every
// public surface" rule the detail page's activeOnly read already enforces),
// and price === null ("電洽") products never enter the online purchase flow
// at all (issue #298 acceptance criteria) — listings has no equivalent
// server-side guard for this today (its UI simply never renders the buy
// form), but this is a brand-new flow so it gets the stricter check.

export interface ProductPurchaseState {
  isActive: boolean;
  price: number | null;
  stockRemaining: number;
}

export type ProductPurchaseOutcome = { ok: true } | { ok: false; errorCode: ErrorCode };

export function resolveProductPurchase(state: ProductPurchaseState, quantity: number): ProductPurchaseOutcome {
  if (!state.isActive) {
    return { ok: false, errorCode: "PRODUCT_NOT_ACTIVE" };
  }
  if (state.price === null) {
    return { ok: false, errorCode: "PRODUCT_CALL_FOR_PRICE" };
  }
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, errorCode: "INVALID_QUANTITY" };
  }
  if (quantity > state.stockRemaining) {
    return { ok: false, errorCode: "INSUFFICIENT_STOCK" };
  }
  return { ok: true };
}

export interface ProductOrderRow {
  id: number;
}

// Buyer-facing purchase — DB transaction + SELECT...FOR UPDATE row lock on
// the product, same anti-oversell shape as lib/listings.ts's purchaseListing.
export async function purchaseProduct(
  productId: number,
  buyerId: number,
  quantity: number,
): Promise<ProductPurchaseOutcome> {
  const db = await getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT is_active, price, stock_remaining FROM products WHERE id = ? FOR UPDATE",
      [productId],
    );
    const product = (rows as { is_active: number; price: number | null; stock_remaining: number | null }[])[0];
    if (!product) {
      await connection.rollback();
      return { ok: false, errorCode: "NOT_FOUND" };
    }

    // Issue #237's profile-completeness guard, same rule as
    // purchaseListing — a buyer without phone/address must complete their
    // profile before ordering.
    const [userRows] = await connection.query(
      "SELECT phone, address FROM users WHERE id = ? LIMIT 1",
      [buyerId],
    );
    const buyer = (userRows as { phone: string | null; address: string | null }[])[0];
    if (!buyer || !buyer.phone?.trim() || !buyer.address?.trim()) {
      await connection.rollback();
      return { ok: false, errorCode: "PROFILE_INCOMPLETE" };
    }

    const result = resolveProductPurchase(
      { isActive: Boolean(product.is_active), price: product.price, stockRemaining: product.stock_remaining ?? 0 },
      quantity,
    );
    if (!result.ok) {
      await connection.rollback();
      return result;
    }

    const unitPrice = product.price as number;
    const totalAmount = unitPrice * quantity;

    await connection.query("UPDATE products SET stock_remaining = stock_remaining - ? WHERE id = ?", [
      quantity,
      productId,
    ]);
    const [insertResult] = await connection.query(
      `INSERT INTO product_orders
         (product_id, buyer_id, quantity, unit_price, total_amount, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [productId, buyerId, quantity, unitPrice, totalAmount],
    );

    await connection.commit();

    // Fired without awaiting — see the equivalent note in
    // lib/listings.ts's purchaseListing.
    notifyProductOrderConfirmed((insertResult as { insertId: number }).insertId);

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ---------------------------------------------------------------------------
// Admin order management — list/search/filter/paginate, mirroring
// lib/listings.ts's getOrdersForAdmin, plus the status-transition write and
// the buyer-profile lookup for the admin "展開查看買家聯絡資訊" UI.

export interface ProductOrderSummary {
  id: number;
  productId: number;
  productTitle: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  status: ProductOrderStatus;
  trackingNumber: string | null;
  createdAt: Date;
  /** Same "帳號已刪除" fallback convention as lib/listings.ts's OrderSummary.buyerEmail. */
  buyerEmail: string;
}

export type ProductOrderStatusFilter = "all" | ProductOrderStatus;
export type ProductOrderSort = "created_desc" | "amount_desc";

export interface ListProductOrdersOptions {
  search?: string;
  buyerEmail?: string;
  status?: ProductOrderStatusFilter;
  sort?: ProductOrderSort;
  page?: number;
}

export const PRODUCT_ORDERS_PAGE_SIZE = 50;

const PRODUCT_ORDER_SORT_CLAUSES: Record<ProductOrderSort, string> = {
  created_desc: "po.created_at DESC",
  amount_desc: "po.total_amount DESC",
};

interface ProductOrderRowRaw {
  id: number;
  product_id: number;
  productTitle: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: ProductOrderStatus;
  tracking_number: string | null;
  created_at: Date;
  buyerEmail: string | null;
}

function mapProductOrderRow(row: ProductOrderRowRaw): ProductOrderSummary {
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: row.productTitle,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    totalAmount: row.total_amount,
    status: row.status,
    trackingNumber: row.tracking_number,
    createdAt: row.created_at,
    buyerEmail: row.buyerEmail ?? "（帳號已刪除）",
  };
}

export async function getProductOrdersForAdmin(
  options: ListProductOrdersOptions = {},
): Promise<{ orders: ProductOrderSummary[]; total: number }> {
  const db = await getDb();
  const keywordSearch = buildKeywordSearch(options.search, {
    columns: ["p.title"],
    rankColumn: "p.title",
  });
  const conditions: string[] = [...keywordSearch.conditions];
  const params: string[] = [...keywordSearch.params];

  const buyerEmail = options.buyerEmail?.trim();
  if (buyerEmail) {
    conditions.push("u.email LIKE ?");
    params.push(`%${buyerEmail}%`);
  }
  if (options.status && options.status !== "all") {
    conditions.push("po.status = ?");
    params.push(options.status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM product_orders po
     JOIN products p ON p.id = po.product_id
     LEFT JOIN users u ON u.id = po.buyer_id
     ${where}`,
    params,
  );
  const total = (countRows as { cnt: number }[])[0].cnt;

  const orderBy = PRODUCT_ORDER_SORT_CLAUSES[options.sort ?? "created_desc"];
  const orderByExpr = `${keywordSearch.rankPrefix}${orderBy}`;
  const { offset, limit } = paginate(options.page, PRODUCT_ORDERS_PAGE_SIZE);

  const [rows] = await db.query(
    `SELECT po.id AS id, po.product_id AS product_id, p.title AS productTitle,
            po.quantity AS quantity, po.unit_price AS unit_price, po.total_amount AS total_amount,
            po.status AS status, po.tracking_number AS tracking_number, po.created_at AS created_at,
            u.email AS buyerEmail
     FROM product_orders po
     JOIN products p ON p.id = po.product_id
     LEFT JOIN users u ON u.id = po.buyer_id
     ${where}
     ORDER BY ${orderByExpr}
     LIMIT ${limit} OFFSET ${offset}`,
    [...params, ...keywordSearch.rankParams],
  );

  return { orders: (rows as ProductOrderRowRaw[]).map(mapProductOrderRow), total };
}

export interface ProductOrderBuyerProfile {
  displayName: string | null;
  phone: string | null;
  address: string | null;
}

// Powers the admin product-orders page's expandable "買家資料" section —
// same shape/reasoning as lib/settlement.ts's getBuyerProfileForOrder, kept
// as an independent copy here rather than a shared helper since that module
// is explicitly listings-only per this ticket's scope.
export async function getBuyerProfileForProductOrder(orderId: number): Promise<ProductOrderBuyerProfile | null> {
  const db = await getDb();
  const [rows] = await db.query(
    `SELECT u.display_name AS displayName, u.phone AS phone, u.address AS address
     FROM product_orders po
     JOIN users u ON u.id = po.buyer_id
     WHERE po.id = ?
     LIMIT 1`,
    [orderId],
  );
  return (rows as ProductOrderBuyerProfile[])[0] ?? null;
}

export type UpdateProductOrderStatusOutcome = { ok: true } | { ok: false; error: string };

// Admin status change (標記出貨／完成／取消／退款), with an optional
// free-text tracking number (issue #298: "admin 只需記錄物流單號文字，無買家
// 追蹤頁"). Row-locked the same way as purchaseProduct so a concurrent
// double-click can't apply two conflicting transitions from the same
// starting state.
export async function updateProductOrderStatus(
  orderId: number,
  nextStatus: ProductOrderStatus,
  trackingNumber?: string | null,
): Promise<UpdateProductOrderStatusOutcome> {
  const db = await getDb();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT status FROM product_orders WHERE id = ? FOR UPDATE", [orderId]);
    const order = (rows as { status: ProductOrderStatus }[])[0];
    if (!order) {
      await connection.rollback();
      return { ok: false, error: "找不到這筆訂單" };
    }

    const transition = resolveProductOrderStatusTransition(order.status, nextStatus);
    if (!transition.ok) {
      await connection.rollback();
      return transition;
    }

    if (trackingNumber !== undefined) {
      await connection.query(
        "UPDATE product_orders SET status = ?, tracking_number = ?, updated_at = NOW() WHERE id = ?",
        [nextStatus, trackingNumber, orderId],
      );
    } else {
      await connection.query("UPDATE product_orders SET status = ?, updated_at = NOW() WHERE id = ?", [
        nextStatus,
        orderId,
      ]);
    }

    await connection.commit();
    return { ok: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
