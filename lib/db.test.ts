// Issue #118's schema migration is the one this ticket requires a direct
// test for: it must grandfather every already-registered account in as
// verified in the same step that adds the column, so a pre-existing user is
// never locked out of login by this change. ensureEmailVerificationColumns
// takes a mysql.Pool directly (see lib/db.ts), so this mocks a minimal
// { query } stand-in rather than going through getDb()/vi.mock("@/lib/db")
// like the rest of this project's DB-touching tests do — there is no
// module to mock here, this *is* the module under test.
import { describe, expect, it, vi } from "vitest";
import { ensureEmailVerificationColumns } from "./db";

function fakePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Parameters<typeof ensureEmailVerificationColumns>[0];
}

describe("ensureEmailVerificationColumns", () => {
  it("adds the column and backfills every existing user to verified when the column is missing", async () => {
    const calls: [string, unknown[] | undefined][] = [];
    const db = fakePool((sql, params) => {
      calls.push([sql, params]);
      if (sql.includes("information_schema.COLUMNS")) {
        return [[{ cnt: 0 }]]; // column doesn't exist yet
      }
      return [{}];
    });

    await ensureEmailVerificationColumns(db);

    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toContain("information_schema.COLUMNS");
    expect(calls[0][1]).toEqual(["users", "email_verified"]);
    expect(calls[1][0]).toBe("ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0");
    expect(calls[2][0]).toBe("UPDATE users SET email_verified = 1");
  });

  it("is idempotent: does nothing further once the column already exists", async () => {
    const calls: [string, unknown[] | undefined][] = [];
    const db = fakePool((sql, params) => {
      calls.push([sql, params]);
      if (sql.includes("information_schema.COLUMNS")) {
        return [[{ cnt: 1 }]]; // column already exists
      }
      return [{}];
    });

    await ensureEmailVerificationColumns(db);

    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toContain("information_schema.COLUMNS");
  });
});
