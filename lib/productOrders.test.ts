// lib/productOrders.ts's transaction-locking purchase flow and the
// product_orders admin queries are raw-SQL data access (no ORM, see
// lib/db.ts), so — same "mock @/lib/db's getDb() and assert on the SQL each
// function sends" approach as lib/listings.test.ts — this mocks a
// transactional connection (getConnection) plus the plain pool query, and
// asserts on both outcomes and the exact SQL/params sent. The pure
// resolveProductPurchase/canTransitionProductOrderStatus functions get
// direct unit tests with no mocking at all, same split as lib/purchase.ts's
// resolvePurchase vs lib/listings.ts's purchaseListing.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canTransitionProductOrderStatus,
  getProductOrdersForAdmin,
  isProductOrderStatusTerminal,
  purchaseProduct,
  resolveProductOrderStatusTransition,
  resolveProductPurchase,
  updateProductOrderStatus,
  type ProductOrderStatus,
} from "./productOrders";

const { queryMock, connectionQueryMock, beginTransactionMock, commitMock, rollbackMock } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const connectionQueryMock = vi.fn();
  const beginTransactionMock = vi.fn();
  const commitMock = vi.fn();
  const rollbackMock = vi.fn();
  return { queryMock, connectionQueryMock, beginTransactionMock, commitMock, rollbackMock };
});

vi.mock("@/lib/db", () => ({
  getDb: async () => ({
    query: queryMock,
    getConnection: async () => ({
      query: connectionQueryMock,
      beginTransaction: beginTransactionMock,
      commit: commitMock,
      rollback: rollbackMock,
      release: vi.fn(),
    }),
  }),
}));

const notifyProductOrderConfirmedMock = vi.fn();
vi.mock("@/lib/notifications", () => ({
  notifyProductOrderConfirmed: (...args: unknown[]) => notifyProductOrderConfirmedMock(...args),
}));

beforeEach(() => {
  queryMock.mockReset();
  connectionQueryMock.mockReset();
  beginTransactionMock.mockReset();
  commitMock.mockReset();
  rollbackMock.mockReset();
  notifyProductOrderConfirmedMock.mockReset();
});

describe("resolveProductPurchase", () => {
  it("accepts a valid quantity within stock for an active, priced product", () => {
    expect(resolveProductPurchase({ isActive: true, price: 100, stockRemaining: 5 }, 3)).toEqual({ ok: true });
  });

  it("accepts buying the exact remaining stock", () => {
    expect(resolveProductPurchase({ isActive: true, price: 100, stockRemaining: 5 }, 5)).toEqual({ ok: true });
  });

  it("rejects an inactive (下架) product", () => {
    expect(resolveProductPurchase({ isActive: false, price: 100, stockRemaining: 5 }, 1)).toEqual({
      ok: false,
      errorCode: "PRODUCT_NOT_ACTIVE",
    });
  });

  it("rejects a call-for-price product (price === null), regardless of stock", () => {
    expect(resolveProductPurchase({ isActive: true, price: null, stockRemaining: 5 }, 1)).toEqual({
      ok: false,
      errorCode: "PRODUCT_CALL_FOR_PRICE",
    });
  });

  it("rejects non-finite, zero, negative, or non-integer quantities", () => {
    const base = { isActive: true, price: 100, stockRemaining: 5 };
    expect(resolveProductPurchase(base, NaN).ok).toBe(false);
    expect(resolveProductPurchase(base, 0).ok).toBe(false);
    expect(resolveProductPurchase(base, -1).ok).toBe(false);
    expect(resolveProductPurchase(base, 1.5).ok).toBe(false);
  });

  it("rejects a quantity exceeding remaining stock", () => {
    const result = resolveProductPurchase({ isActive: true, price: 100, stockRemaining: 2 }, 3);
    expect(result).toEqual({ ok: false, errorCode: "INSUFFICIENT_STOCK" });
  });

  it("rejects any purchase when stock is already exhausted", () => {
    const result = resolveProductPurchase({ isActive: true, price: 100, stockRemaining: 0 }, 1);
    expect(result).toEqual({ ok: false, errorCode: "INSUFFICIENT_STOCK" });
  });

  it("checks isActive before price (a 下架 call-for-price product still reports PRODUCT_NOT_ACTIVE)", () => {
    expect(resolveProductPurchase({ isActive: false, price: null, stockRemaining: 0 }, 1)).toEqual({
      ok: false,
      errorCode: "PRODUCT_NOT_ACTIVE",
    });
  });
});

describe("canTransitionProductOrderStatus / resolveProductOrderStatusTransition", () => {
  const ALL_STATUSES: ProductOrderStatus[] = ["pending", "shipped", "completed", "cancelled", "refunded"];

  const VALID_TRANSITIONS: [ProductOrderStatus, ProductOrderStatus][] = [
    ["pending", "shipped"],
    ["pending", "cancelled"],
    ["pending", "refunded"],
    ["shipped", "completed"],
    ["shipped", "cancelled"],
    ["shipped", "refunded"],
  ];

  it("allows exactly the documented main-line and terminal-escape transitions", () => {
    for (const [from, to] of VALID_TRANSITIONS) {
      expect(canTransitionProductOrderStatus(from, to)).toBe(true);
      expect(resolveProductOrderStatusTransition(from, to)).toEqual({ ok: true });
    }
  });

  it("rejects every other pair, including same-state and skipping ahead", () => {
    const validSet = new Set(VALID_TRANSITIONS.map(([from, to]) => `${from}->${to}`));
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (validSet.has(`${from}->${to}`)) continue;
        expect(canTransitionProductOrderStatus(from, to)).toBe(false);
        expect(resolveProductOrderStatusTransition(from, to).ok).toBe(false);
      }
    }
  });

  it("rejects skipping pending straight to completed", () => {
    expect(canTransitionProductOrderStatus("pending", "completed")).toBe(false);
  });

  it("treats completed/cancelled/refunded as terminal — no transitions out of them", () => {
    for (const terminal of ["completed", "cancelled", "refunded"] as const) {
      expect(isProductOrderStatusTerminal(terminal)).toBe(true);
      for (const to of ALL_STATUSES) {
        expect(canTransitionProductOrderStatus(terminal, to)).toBe(false);
      }
    }
  });

  it("does not consider pending/shipped terminal", () => {
    expect(isProductOrderStatusTerminal("pending")).toBe(false);
    expect(isProductOrderStatusTerminal("shipped")).toBe(false);
  });
});

describe("purchaseProduct", () => {
  it("returns NOT_FOUND and rolls back when the product doesn't exist", async () => {
    connectionQueryMock.mockResolvedValueOnce([[]]);

    const result = await purchaseProduct(1, 10, 2);

    expect(result).toEqual({ ok: false, errorCode: "NOT_FOUND" });
    expect(rollbackMock).toHaveBeenCalled();
    expect(commitMock).not.toHaveBeenCalled();
  });

  it("rejects with PROFILE_INCOMPLETE when the buyer has no phone/address, before touching stock", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[{ is_active: 1, price: 500, stock_remaining: 5 }]])
      .mockResolvedValueOnce([[{ phone: null, address: null }]]);

    const result = await purchaseProduct(1, 10, 2);

    expect(result).toEqual({ ok: false, errorCode: "PROFILE_INCOMPLETE" });
    expect(rollbackMock).toHaveBeenCalled();
    // Only the two SELECTs ran — no UPDATE/INSERT before the guard rejected it.
    expect(connectionQueryMock).toHaveBeenCalledTimes(2);
  });

  it("rejects with INSUFFICIENT_STOCK (anti-oversell) without writing anything", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[{ is_active: 1, price: 500, stock_remaining: 1 }]])
      .mockResolvedValueOnce([[{ phone: "0912345678", address: "台北市" }]]);

    const result = await purchaseProduct(1, 10, 2);

    expect(result).toEqual({ ok: false, errorCode: "INSUFFICIENT_STOCK" });
    expect(rollbackMock).toHaveBeenCalled();
    expect(connectionQueryMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a call-for-price product even with a complete profile and available stock", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[{ is_active: 1, price: null, stock_remaining: 5 }]])
      .mockResolvedValueOnce([[{ phone: "0912345678", address: "台北市" }]]);

    const result = await purchaseProduct(1, 10, 1);

    expect(result).toEqual({ ok: false, errorCode: "PRODUCT_CALL_FOR_PRICE" });
    expect(rollbackMock).toHaveBeenCalled();
  });

  it("locks the row (SELECT ... FOR UPDATE), decrements stock, inserts a pending order, commits, and notifies", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[{ is_active: 1, price: 500, stock_remaining: 5 }]])
      .mockResolvedValueOnce([[{ phone: "0912345678", address: "台北市" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // stock decrement
      .mockResolvedValueOnce([{ insertId: 77 }]); // order insert

    const result = await purchaseProduct(1, 10, 2);

    expect(result).toEqual({ ok: true });
    expect(beginTransactionMock).toHaveBeenCalled();
    expect(commitMock).toHaveBeenCalled();
    expect(rollbackMock).not.toHaveBeenCalled();

    const [selectSql] = connectionQueryMock.mock.calls[0];
    expect(selectSql).toContain("FOR UPDATE");

    const [updateSql, updateParams] = connectionQueryMock.mock.calls[2];
    expect(updateSql).toContain("UPDATE products SET stock_remaining = stock_remaining - ?");
    expect(updateParams).toEqual([2, 1]);

    const [insertSql, insertParams] = connectionQueryMock.mock.calls[3];
    expect(insertSql).toContain("INSERT INTO product_orders");
    expect(insertSql).toContain("'pending'");
    // product_id, buyer_id, quantity, unit_price, total_amount
    expect(insertParams).toEqual([1, 10, 2, 500, 1000]);

    expect(notifyProductOrderConfirmedMock).toHaveBeenCalledWith(77);
  });

  it("rolls back and never commits when a write fails partway through", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[{ is_active: 1, price: 500, stock_remaining: 5 }]])
      .mockResolvedValueOnce([[{ phone: "0912345678", address: "台北市" }]])
      .mockRejectedValueOnce(new Error("connection lost"));

    await expect(purchaseProduct(1, 10, 1)).rejects.toThrow("connection lost");

    expect(commitMock).not.toHaveBeenCalled();
    expect(rollbackMock).toHaveBeenCalled();
    expect(notifyProductOrderConfirmedMock).not.toHaveBeenCalled();
  });
});

describe("updateProductOrderStatus", () => {
  it("returns an error and rolls back when the order doesn't exist", async () => {
    connectionQueryMock.mockResolvedValueOnce([[]]);

    const result = await updateProductOrderStatus(1, "shipped");

    expect(result).toEqual({ ok: false, error: "找不到這筆訂單" });
    expect(rollbackMock).toHaveBeenCalled();
  });

  it("rejects an invalid transition and rolls back without writing", async () => {
    connectionQueryMock.mockResolvedValueOnce([[{ status: "completed" }]]);

    const result = await updateProductOrderStatus(1, "shipped");

    expect(result.ok).toBe(false);
    expect(rollbackMock).toHaveBeenCalled();
    expect(connectionQueryMock).toHaveBeenCalledTimes(1);
  });

  it("applies a valid transition, commits, and includes tracking_number when provided", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[{ status: "pending" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await updateProductOrderStatus(1, "shipped", "SF1234567890");

    expect(result).toEqual({ ok: true });
    expect(commitMock).toHaveBeenCalled();
    const [sql, params] = connectionQueryMock.mock.calls[1];
    expect(sql).toContain("tracking_number = ?");
    expect(params).toEqual(["shipped", "SF1234567890", 1]);
  });

  it("leaves tracking_number untouched when omitted", async () => {
    connectionQueryMock
      .mockResolvedValueOnce([[{ status: "shipped" }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await updateProductOrderStatus(1, "completed");

    expect(result).toEqual({ ok: true });
    const [sql, params] = connectionQueryMock.mock.calls[1];
    expect(sql).not.toContain("tracking_number");
    expect(params).toEqual(["completed", 1]);
  });
});

describe("getProductOrdersForAdmin", () => {
  beforeEach(() => {
    queryMock.mockResolvedValue([[{ cnt: 0 }]]);
  });

  it("filters by status when one is given", async () => {
    await getProductOrdersForAdmin({ status: "shipped" });
    const countCall = queryMock.mock.calls[0];
    expect(countCall[0]).toContain("po.status = ?");
    expect(countCall[1]).toContain("shipped");
  });

  it("omits the status condition for 'all' or when unset", async () => {
    await getProductOrdersForAdmin({ status: "all" });
    expect(queryMock.mock.calls[0][0]).not.toContain("po.status = ?");
  });

  it("filters by buyer email substring", async () => {
    await getProductOrdersForAdmin({ buyerEmail: "test@example.com" });
    const countCall = queryMock.mock.calls[0];
    expect(countCall[0]).toContain("u.email LIKE ?");
    expect(countCall[1]).toContain("%test@example.com%");
  });
});
