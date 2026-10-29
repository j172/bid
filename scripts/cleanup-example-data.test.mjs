import { describe, expect, it, vi } from "vitest";
import {
  DIRECT_EMAIL_TABLES,
  LISTING_CASCADE_TABLES,
  USER_AUTH_CASCADE_TABLES,
  backupExampleData,
  executeCleanup,
  listExampleUsers,
  planCleanup,
} from "./cleanup-example-data.mjs";

function fakeConn(queryImpl) {
  return {
    query: vi.fn(queryImpl),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
  };
}

describe("table constants", () => {
  it("defines the expected cascade and direct-email table lists", () => {
    expect(LISTING_CASCADE_TABLES).toEqual(["bids", "purchases", "listing_photos"]);
    expect(USER_AUTH_CASCADE_TABLES).toEqual([
      "sessions",
      "password_reset_tokens",
      "email_verification_tokens",
      "email_otp_challenges",
      "webauthn_challenges",
      "webauthn_credentials",
      "totp_setup_challenges",
      "totp_backup_codes",
    ]);
    expect(DIRECT_EMAIL_TABLES).toEqual(["contact_messages", "login_attempts"]);
  });
});

describe("listExampleUsers", () => {
  it("queries matching @example.com users without password/secret columns", async () => {
    const calls = [];
    const conn = fakeConn((sql) => {
      calls.push(sql);
      return [[{ id: 10, email: "test@example.com", role: "user", display_name: "Test", created_at: "2026-01-01" }]];
    });

    const users = await listExampleUsers(conn);

    expect(users).toHaveLength(1);
    expect(calls[0]).toContain("LOWER(email) LIKE '%@example.com'");
    expect(calls[0]).not.toContain("password_hash");
    expect(calls[0]).not.toContain("totp_secret");
  });
});

describe("planCleanup", () => {
  it("counts all affected tables without any write queries or transaction", async () => {
    const calls = [];
    const conn = fakeConn((sql) => {
      calls.push(sql);
      return [[{ cnt: 2 }]];
    });

    const counts = await planCleanup(conn);

    expect(counts).toEqual({
      listing_bids: 2,
      listing_purchases: 2,
      listing_photos: 2,
      listings: 2,
      user_bids: 2,
      user_purchases: 2,
      product_orders: 2,
      recalculated_listings: 2,
      sessions: 2,
      password_reset_tokens: 2,
      email_verification_tokens: 2,
      email_otp_challenges: 2,
      webauthn_challenges: 2,
      webauthn_credentials: 2,
      totp_setup_challenges: 2,
      totp_backup_codes: 2,
      users: 2,
      contact_messages: 2,
      login_attempts: 2,
    });
    expect(calls.every((sql) => sql.startsWith("SELECT COUNT(*)"))).toBe(true);
    expect(calls.some((sql) => /\b(DELETE|UPDATE|INSERT)\b/i.test(sql))).toBe(false);
    expect(conn.beginTransaction).not.toHaveBeenCalled();
  });
});

describe("backupExampleData", () => {
  it("exports read-only snapshots of all affected tables", async () => {
    const calls = [];
    const conn = fakeConn((sql) => {
      calls.push(sql);
      return [[{ id: 1 }]];
    });

    const snapshot = await backupExampleData(conn);

    expect(snapshot.exportedAt).toBeTruthy();
    expect(Object.keys(snapshot.tables)).toEqual([
      "users",
      "listings",
      "listing_bids",
      "listing_purchases",
      "listing_photos",
      "user_bids",
      "user_purchases",
      "product_orders",
      "affected_surviving_listings",
      "contact_messages",
      "login_attempts",
    ]);
    expect(calls.some((sql) => /\b(DELETE|UPDATE|INSERT)\b/i.test(sql))).toBe(false);
  });
});

describe("executeCleanup", () => {
  it("deletes all @example.com records in cascade order, recalculates surviving listings, and commits", async () => {
    const calls = [];
    const conn = fakeConn((sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id FROM listings WHERE leader_user_id IN")) {
        return [[{ id: 101 }, { id: 102 }]];
      }
      if (sql.startsWith("SELECT user_id, amount, max_amount FROM bids WHERE listing_id = ?")) {
        if (params[0] === 101) {
          return [[{ user_id: 99, amount: 5000, max_amount: 6000 }]];
        }
        return [[]];
      }
      if (sql.startsWith("UPDATE listings")) {
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("DELETE FROM")) {
        return [{ affectedRows: 3 }];
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const counts = await executeCleanup(conn);

    expect(counts.listing_bids).toBe(3);
    expect(counts.listings).toBe(3);
    expect(counts.user_bids).toBe(3);
    expect(counts.recalculated_listings).toBe(2);
    expect(counts.users).toBe(3);
    expect(counts.contact_messages).toBe(3);
    expect(counts.login_attempts).toBe(3);

    // Check recalculate queries for listing 101 (has remaining bid) and 102 (no remaining bids)
    const updateCalls = calls.filter((c) => c.sql.startsWith("UPDATE listings"));
    expect(updateCalls).toEqual([
      {
        sql: "UPDATE listings SET leader_user_id = ?, leader_max_amount = ?, current_price = ? WHERE id = ?",
        params: [99, 6000, 5000, 101],
      },
      {
        sql: "UPDATE listings SET leader_user_id = NULL, leader_max_amount = NULL, current_price = COALESCE(starting_price, price, 0) WHERE id = ?",
        params: [102],
      },
    ]);

    // Ensure users delete happens after listing and auth cascade deletes
    const sqlList = calls.map((c) => c.sql);
    const deleteListingsIdx = sqlList.findIndex((s) => s.startsWith("DELETE FROM listings "));
    const deleteSessionsIdx = sqlList.findIndex((s) => s.startsWith("DELETE FROM sessions "));
    const deleteUsersIdx = sqlList.findIndex((s) => s.startsWith("DELETE FROM users "));
    expect(deleteListingsIdx).toBeGreaterThan(0);
    expect(deleteSessionsIdx).toBeGreaterThan(deleteListingsIdx);
    expect(deleteUsersIdx).toBeGreaterThan(deleteSessionsIdx);

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  it("rolls back and rethrows if any query fails midway", async () => {
    const conn = fakeConn((sql) => {
      if (sql.startsWith("DELETE FROM users")) {
        throw new Error("DB error on users delete");
      }
      if (sql.startsWith("SELECT id FROM listings")) {
        return [[]];
      }
      return [{ affectedRows: 1 }];
    });

    await expect(executeCleanup(conn)).rejects.toThrow("DB error on users delete");

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });
});
