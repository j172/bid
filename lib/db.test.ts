// Issue #118's schema migration is the one this ticket requires a direct
// test for: it must grandfather every already-registered account in as
// verified in the same step that adds the column, so a pre-existing user is
// never locked out of login by this change. ensureEmailVerificationColumns
// takes a mysql.Pool directly (see lib/db.ts), so this mocks a minimal
// { query } stand-in rather than going through getDb()/vi.mock("@/lib/db")
// like the rest of this project's DB-touching tests do — there is no
// module to mock here, this *is* the module under test.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureEmailVerificationColumns,
  ensureGoogleAuthColumns,
  ensureHomepageVideosVideoIdIndex,
  ensureYoutubeUrlColumns,
  schemaStatements,
  splitSqlStatements,
} from "./db";

function fakePool(queryImpl: (sql: string, params?: unknown[]) => unknown) {
  return { query: vi.fn(queryImpl) } as unknown as Parameters<typeof ensureEmailVerificationColumns>[0];
}

// getDb() caches its pool and its in-flight schema-init promise in
// module-level `pool`/`ready` variables (see lib/db.ts), so — like
// lib/scheduler.test.ts's `started` flag — each test here needs a fresh
// module instance via vi.resetModules() + a fresh dynamic import. mysql2 is
// mocked so ensureSchema's DDL/information_schema checks run against a
// stub `query` this suite controls directly, rather than a real connection.
const { queryMock, createPoolMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  createPoolMock: vi.fn(),
}));

vi.mock("mysql2/promise", () => ({
  default: { createPool: createPoolMock },
}));

describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    createPoolMock.mockReset();
    createPoolMock.mockReturnValue({ query: queryMock });
  });

  it("retries ensureSchema on the next call after a failed attempt, instead of permanently caching the rejection (issue #345)", async () => {
    let calls = 0;
    queryMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        // Simulate a transient failure on the very first query of the
        // first ensureSchema() attempt (e.g. a cold-start connection drop).
        throw new Error("ECONNREFUSED");
      }
      return [[{ cnt: 1 }]];
    });

    const { getDb } = await import("./db");

    await expect(getDb()).rejects.toThrow("ECONNREFUSED");
    // Without the reset-on-failure fix, this second call would just replay
    // the same cached rejection forever instead of retrying.
    await expect(getDb()).resolves.toBeDefined();

    // The pool itself is reused across both attempts (createPool runs
    // once) — only the cached schema-init promise gets reset and retried.
    expect(createPoolMock).toHaveBeenCalledTimes(1);
    expect(calls).toBeGreaterThan(1);
  });

  it("still shares a single ensureSchema run across concurrent callers on a successful init", async () => {
    queryMock.mockResolvedValue([[{ cnt: 1 }]]);

    const { getDb } = await import("./db");

    const [a, b, c] = await Promise.all([getDb(), getDb(), getDb()]);

    expect(a).toBe(b);
    expect(b).toBe(c);
    // Concurrent callers during a successful init share one in-flight
    // ensureSchema()/createPool() run rather than each starting their own.
    expect(createPoolMock).toHaveBeenCalledTimes(1);

    const callsAfterInit = queryMock.mock.calls.length;
    await getDb();

    // Once ensureSchema has already succeeded, `ready` stays cached — a
    // later call must not re-run the schema DDL/checks again.
    expect(queryMock.mock.calls.length).toBe(callsAfterInit);
  });
});

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

describe("ensureHomepageVideosVideoIdIndex", () => {
  it("is a no-op when the unique index already exists", async () => {
    const query = vi.fn().mockResolvedValueOnce([[{ cnt: 1 }]]);
    const db = fakePool(query);

    await ensureHomepageVideosVideoIdIndex(db);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("information_schema.STATISTICS");
  });

  it("reports duplicate data without deleting anything when index creation fails", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([[{ cnt: 0 }]])
      .mockRejectedValueOnce(Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" }));
    const db = fakePool(query);

    await expect(ensureHomepageVideosVideoIdIndex(db)).rejects.toThrow(
      /homepage_videos[\s\S]*uq_homepage_videos_video_id[\s\S]*duplicate data[\s\S]*手動清理/i,
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.some(([sql]) => String(sql).match(/DELETE|UPDATE/i))).toBe(false);
  });
});

describe("ensureGoogleAuthColumns", () => {
  it("adds google_id, creates unique index, and relaxes password nullability", async () => {
    const calls: [string, unknown[] | undefined][] = [];
    const db = fakePool((sql, params) => {
      calls.push([sql, params]);
      if (sql.includes("information_schema.COLUMNS")) {
        return [[{ cnt: 0 }]];
      }
      if (sql.includes("information_schema.STATISTICS")) {
        return [[{ cnt: 0 }]];
      }
      return [{}];
    });

    await ensureGoogleAuthColumns(db);

    expect(calls[0][0]).toContain("information_schema.COLUMNS");
    expect(calls[0][1]).toEqual(["users", "google_id"]);
    expect(calls[1][0]).toBe("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL");
    expect(calls[2][0]).toContain("information_schema.STATISTICS");
    expect(calls[2][1]).toEqual(["users", "uq_users_google_id"]);
    expect(calls[3][0]).toBe("ALTER TABLE users ADD UNIQUE KEY uq_users_google_id (google_id)");
    expect(calls[4][0]).toBe("ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL");
    expect(calls[5][0]).toBe("ALTER TABLE users MODIFY COLUMN password_salt VARCHAR(255) NULL");
  });
});

describe("ensureYoutubeUrlColumns", () => {
  it("adds youtube_url to both listings and products when missing", async () => {
    const calls: [string, unknown[] | undefined][] = [];
    const db = fakePool((sql, params) => {
      calls.push([sql, params]);
      if (sql.includes("information_schema.COLUMNS")) {
        return [[{ cnt: 0 }]];
      }
      return [{}];
    });

    await ensureYoutubeUrlColumns(db);

    expect(calls).toHaveLength(4);
    expect(calls[0][1]).toEqual(["listings", "youtube_url"]);
    expect(calls[1][0]).toBe("ALTER TABLE listings ADD COLUMN youtube_url VARCHAR(255) NULL");
    expect(calls[2][1]).toEqual(["products", "youtube_url"]);
    expect(calls[3][0]).toBe("ALTER TABLE products ADD COLUMN youtube_url VARCHAR(255) NULL");
  });

  it("is idempotent: does nothing further once both columns already exist", async () => {
    const calls: [string, unknown[] | undefined][] = [];
    const db = fakePool((sql, params) => {
      calls.push([sql, params]);
      return [[{ cnt: 1 }]];
    });

    await ensureYoutubeUrlColumns(db);

    expect(calls).toHaveLength(2);
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
    for (const table of ["users", "sessions", "listings", "bids", "purchases", "login_attempts", "homepage_videos"]) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS ${table} (`);
    }
    expect(joined).toContain("UNIQUE KEY uq_homepage_videos_video_id (video_id)");
  });
});
