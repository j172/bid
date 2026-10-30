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
  ensureClubAwardSortOrder,
  ensureHomepageVideosVideoIdIndex,
  ensureLineUserIdColumn,
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

describe("ensureLineUserIdColumn", () => {
  it("adds line_user_id and creates unique index when missing", async () => {
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

    await ensureLineUserIdColumn(db);

    expect(calls[0][0]).toContain("information_schema.COLUMNS");
    expect(calls[0][1]).toEqual(["users", "line_user_id"]);
    expect(calls[1][0]).toBe("ALTER TABLE users ADD COLUMN line_user_id VARCHAR(255) NULL");
    expect(calls[2][0]).toContain("information_schema.STATISTICS");
    expect(calls[2][1]).toEqual(["users", "uq_users_line_user_id"]);
    expect(calls[3][0]).toBe("ALTER TABLE users ADD UNIQUE KEY uq_users_line_user_id (line_user_id)");
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

describe("ensureClubAwardSortOrder", () => {
  it("keyset-pages albums and pigeons across 500-row batches, preserves ordering, and is repeatable", async () => {
    const calls: [string, unknown[] | undefined][] = [];
    type LegacyRow = { id: number; album_id?: number; created_at: string; sort_order?: number };
    const atOffset = (day: number, seconds: number) =>
      new Date(Date.UTC(2024, 0, 1 + day, 0, 0, seconds)).toISOString().slice(0, 19).replace("T", " ");
    const albums: LegacyRow[] = Array.from({ length: 1_003 }, (_, index) => ({
      id: 3_000 - index,
      created_at: atOffset(0, Math.floor(index / 3)),
    }));
    const pigeons: LegacyRow[] = [
      ...Array.from({ length: 500 }, (_, index) => ({
        id: 10_000 + index,
        album_id: 1,
        created_at: atOffset(0, Math.floor(index / 2)),
      })),
      ...Array.from({ length: 501 }, (_, index) => ({
        id: 20_000 + index,
        album_id: 2,
        created_at: atOffset(1, Math.floor(index / 2)),
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        id: 30_000 + index,
        album_id: 3,
        created_at: atOffset(2, index),
      })),
    ];
    const tableRows = {
      club_award_albums: albums,
      club_award_pigeons: pigeons,
    };
    const indexesExist = new Set<string>();

    const db = fakePool((sql, params) => {
      calls.push([sql, params]);
      if (sql.includes("information_schema.COLUMNS") && sql.includes("COUNT(*)")) {
        return [[{ cnt: 1 }]];
      }
      if (sql.includes("IS_NULLABLE AS is_nullable")) {
        return [[{ is_nullable: "YES" }]];
      }
      if (
        sql.startsWith("SELECT id") &&
        (sql.includes("FROM club_award_albums") || sql.includes("FROM club_award_pigeons"))
      ) {
        const perAlbum = sql.includes("SELECT id, album_id");
        const table = perAlbum ? "club_award_pigeons" : "club_award_albums";
        const source = tableRows[table];
        const queryParams = params ?? [];
        let ordered = [...source].sort((left, right) => {
          if (perAlbum && left.album_id !== right.album_id) return left.album_id! - right.album_id!;
          return right.created_at.localeCompare(left.created_at) || right.id - left.id;
        });

        if (perAlbum && queryParams.length === 6) {
          const [albumId, , createdAt, , id] = queryParams as [number, number, string, string, number, number];
          ordered = ordered.filter(
            (row) =>
              row.album_id! > albumId ||
              (row.album_id === albumId &&
                (row.created_at < createdAt || (row.created_at === createdAt && row.id < id))),
          );
        } else if (!perAlbum && queryParams.length === 4) {
          const [createdAt, , id] = queryParams as [string, string, number, number];
          ordered = ordered.filter(
            (row) => row.created_at < createdAt || (row.created_at === createdAt && row.id < id),
          );
        }

        const pageSize = queryParams[queryParams.length - 1] as number;
        return [[
          ...ordered.slice(0, pageSize).map((row) => ({
            id: row.id,
            ...(perAlbum ? { album_id: row.album_id } : {}),
            cursor_created_at: row.created_at,
          })),
        ]];
      }
      if (sql.startsWith("UPDATE club_award_")) {
        const table = sql.startsWith("UPDATE club_award_albums")
          ? "club_award_albums"
          : "club_award_pigeons";
        const values = params ?? [];
        const assignmentCount = (sql.match(/WHEN \? THEN \?/g) ?? []).length;
        for (let index = 0; index < assignmentCount; index += 1) {
          const id = values[index * 2] as number;
          tableRows[table].find((row) => row.id === id)!.sort_order = values[index * 2 + 1] as number;
        }
        return [{}];
      }
      if (sql.startsWith("ALTER TABLE") && sql.includes("idx_club_award_")) {
        if (sql.includes("idx_club_award_albums_sort_order")) {
          indexesExist.add("idx_club_award_albums_sort_order");
        }
        if (sql.includes("idx_club_award_pigeons_album_sort_order")) {
          indexesExist.add("idx_club_award_pigeons_album_sort_order");
        }
        return [{}];
      }
      if (sql.includes("information_schema.STATISTICS")) {
        return [[{ cnt: indexesExist.has(String(params?.[1])) ? 1 : 0 }]];
      }
      return [{}];
    });

    await ensureClubAwardSortOrder(db);

    const assertBackfilledOrder = () => {
      const expectedAlbums = [...albums].sort(
        (left, right) => right.created_at.localeCompare(left.created_at) || right.id - left.id,
      );
      expectedAlbums.forEach((row, index) => expect(row.sort_order).toBe(index));

      const expectedPigeons = [...pigeons].sort(
        (left, right) =>
          left.album_id! - right.album_id! ||
          right.created_at.localeCompare(left.created_at) ||
          right.id - left.id,
      );
      let currentAlbum = -1;
      let albumSortOrder = 0;
      for (const row of expectedPigeons) {
        if (row.album_id !== currentAlbum) {
          currentAlbum = row.album_id!;
          albumSortOrder = 0;
        }
        expect(row.sort_order).toBe(albumSortOrder);
        albumSortOrder += 1;
      }
    };
    assertBackfilledOrder();

    const selects = calls.filter(([sql]) => sql.startsWith("SELECT id"));
    const updates = calls.filter(([sql]) => sql.startsWith("UPDATE club_award_"));
    const albumSelects = selects.filter(([sql]) => sql.includes("FROM club_award_albums"));
    const pigeonSelects = selects.filter(([sql]) => sql.includes("FROM club_award_pigeons"));
    const albumUpdates = updates.filter(([sql]) => sql.startsWith("UPDATE club_award_albums"));
    const pigeonUpdates = updates.filter(([sql]) => sql.startsWith("UPDATE club_award_pigeons"));
    expect(albumSelects.length).toBeGreaterThanOrEqual(3);
    expect(pigeonSelects.length).toBeGreaterThanOrEqual(3);
    expect(albumUpdates.length).toBeGreaterThanOrEqual(3);
    expect(pigeonUpdates.length).toBeGreaterThanOrEqual(3);

    for (const [sql, params] of selects) {
      expect(sql).toContain("LIMIT ?");
      expect(params?.at(-1)).toBe(500);
      expect(sql).toContain("CAST(created_at AS CHAR) AS cursor_created_at");
      expect(sql).not.toContain("ROW_NUMBER");
    }
    for (const [sql, params] of updates) {
      const rowCount = (sql.match(/WHEN \? THEN \?/g) ?? []).length;
      expect(rowCount).toBeLessThanOrEqual(500);
      expect(params).toHaveLength(rowCount * 3);
    }
    expect(albumSelects[0][0]).toContain("ORDER BY created_at DESC, id DESC");
    expect(pigeonSelects[0][0]).toContain("ORDER BY album_id ASC, created_at DESC, id DESC");
    expect(albumSelects[1][0]).toContain("created_at = ? AND id < ?");
    const firstAlbumPageLastRow = [...albums].sort(
      (left, right) => right.created_at.localeCompare(left.created_at) || right.id - left.id,
    )[499];
    expect(albumSelects[1][1]).toEqual([
      firstAlbumPageLastRow.created_at,
      firstAlbumPageLastRow.created_at,
      firstAlbumPageLastRow.id,
      500,
    ]);
    // Exactly 500 rows in album 1 puts the first keyset boundary immediately
    // before album 2; the following page must continue album 2's index at 0.
    expect(pigeonSelects[1][1]).toEqual([1, 1, pigeons[0].created_at, pigeons[0].created_at, 10_000, 500]);
    expect(pigeonSelects[2][0]).toContain("album_id > ? OR (album_id = ?");
    expect(pigeonSelects[2][1]?.[0]).toBe(2);
    expect(calls.some(([sql]) => sql.includes("ROW_NUMBER"))).toBe(false);
    expect(calls).toContainEqual([
      "ALTER TABLE club_award_albums MODIFY COLUMN sort_order INT NOT NULL DEFAULT 0",
      undefined,
    ]);
    expect(calls).toContainEqual([
      "ALTER TABLE club_award_pigeons MODIFY COLUMN sort_order INT NOT NULL DEFAULT 0",
      undefined,
    ]);
    expect(calls.some(([sql]) => sql.includes("idx_club_award_albums_sort_order"))).toBe(true);
    expect(calls.some(([sql]) => sql.includes("idx_club_award_pigeons_album_sort_order"))).toBe(true);

    const firstRunSortOrders = {
      albums: albums.map(({ id, sort_order }) => [id, sort_order]),
      pigeons: pigeons.map(({ id, sort_order }) => [id, sort_order]),
    };
    calls.length = 0;
    await ensureClubAwardSortOrder(db);
    assertBackfilledOrder();
    expect({
      albums: albums.map(({ id, sort_order }) => [id, sort_order]),
      pigeons: pigeons.map(({ id, sort_order }) => [id, sort_order]),
    }).toEqual(firstRunSortOrders);
  });

  it("is idempotent when both columns are already backfilled and indexed", async () => {
    const calls: [string, unknown[] | undefined][] = [];
    const db = fakePool((sql, params) => {
      calls.push([sql, params]);
      if (sql.includes("IS_NULLABLE AS is_nullable")) {
        return [[{ is_nullable: "NO" }]];
      }
      return [[{ cnt: 1 }]];
    });

    await ensureClubAwardSortOrder(db);

    expect(calls.some(([sql]) => sql.startsWith("UPDATE club_award_"))).toBe(false);
    expect(calls.some(([sql]) => sql.startsWith("ALTER TABLE"))).toBe(false);
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
    for (const table of [
      "users",
      "sessions",
      "listings",
      "bids",
      "purchases",
      "login_attempts",
      "homepage_videos",
      "club_award_albums",
      "club_award_pigeons",
    ]) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS ${table} (`);
    }
    expect(joined).toContain("UNIQUE KEY uq_homepage_videos_video_id (video_id)");
    expect(joined).toContain("sort_order INT NOT NULL DEFAULT 0");
    expect(joined).toContain("KEY idx_club_award_albums_sort_order (sort_order, id)");
    expect(joined).toContain("KEY idx_club_award_pigeons_album_sort_order (album_id, sort_order, id)");
  });
});
