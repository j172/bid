// Issue #118's schema migration is the one this ticket requires a direct
// test for: it must grandfather every already-registered account in as
// verified in the same step that adds the column, so a pre-existing user is
// never locked out of login by this change. ensureEmailVerificationColumns
// takes a mysql.Pool directly (see lib/db.ts), so this mocks a minimal
// { query } stand-in rather than going through getDb()/vi.mock("@/lib/db")
// like the rest of this project's DB-touching tests do — there is no
// module to mock here, this *is* the module under test.
import { describe, expect, it, vi } from "vitest";
import { ensureEmailVerificationColumns, schemaStatements, splitSqlStatements } from "./db";

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

// Issue #140 I-1: the connection pool no longer sets multipleStatements, so
// SCHEMA_SQL has to reach the driver one statement at a time. These pin the
// splitting rule the migration now depends on — if a future schema edit ever
// produced a chunk holding two statements (or none), it would fail here
// rather than at boot on a real database.
describe("splitSqlStatements", () => {
  it("splits on a semicolon at end of line", () => {
    expect(splitSqlStatements("SELECT 1;\nSELECT 2;\n")).toEqual(["SELECT 1", "SELECT 2"]);
  });

  it("ignores semicolons that appear mid-line inside a comment", () => {
    const sql = "-- a note; with a semicolon\nCREATE TABLE a (id INT);\nCREATE TABLE b (id INT);\n";
    expect(splitSqlStatements(sql)).toEqual([
      "-- a note; with a semicolon\nCREATE TABLE a (id INT)",
      "CREATE TABLE b (id INT)",
    ]);
  });

  it("tolerates a trailing statement with no newline after it", () => {
    expect(splitSqlStatements("SELECT 1;")).toEqual(["SELECT 1"]);
    expect(splitSqlStatements("SELECT 1")).toEqual(["SELECT 1"]);
  });

  it("drops blank chunks", () => {
    expect(splitSqlStatements("\n\n;\nSELECT 1;\n\n")).toEqual(["SELECT 1"]);
  });
});

describe("schemaStatements", () => {
  const statements = schemaStatements();

  it("yields exactly one CREATE TABLE per statement", () => {
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      const creates = statement.match(/^CREATE TABLE IF NOT EXISTS/gm) ?? [];
      expect(creates).toHaveLength(1);
    }
  });

  it("never leaves a stray semicolon at the end of a statement", () => {
    for (const statement of statements) {
      expect(statement.endsWith(";")).toBe(false);
    }
  });

  it("still covers the tables the rest of this module reads and writes", () => {
    const joined = statements.join("\n");
    for (const table of ["users", "sessions", "listings", "bids", "purchases", "login_attempts"]) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS ${table} (`);
    }
  });
});
