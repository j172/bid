// Regression coverage for scripts/cleanup-herbots-news.mjs's query logic and
// transaction/rollback behavior, using a mocked mysql2 connection stand-in —
// same "mock a minimal { query } object" approach as
// scripts/cleanup-closed-listings.test.mjs, since this repo has no live
// test-database harness for scripts/. This script is destructive by nature,
// so it must NEVER be tested against a real database, including a
// local/dev one — everything here is pure query-building + control-flow
// verification against fakes.
import { describe, expect, it, vi } from "vitest";
import { executeCleanup, planCleanup } from "./cleanup-herbots-news.mjs";

function fakeConn(queryImpl) {
  return {
    query: vi.fn(queryImpl),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
  };
}

describe("planCleanup", () => {
  it("counts herbots-sourced news_posts rows without writing anything", async () => {
    const calls = [];
    const conn = fakeConn((sql) => {
      calls.push(sql);
      return [[{ cnt: 12 }]];
    });

    const counts = await planCleanup(conn);

    expect(counts).toEqual({ news_posts: 12 });
    expect(calls).toEqual(["SELECT COUNT(*) AS cnt FROM news_posts WHERE source = 'herbots'"]);
    expect(conn.beginTransaction).not.toHaveBeenCalled();
  });

  it("reports zero when there are no herbots-sourced rows", async () => {
    const conn = fakeConn(() => [[{ cnt: 0 }]]);

    const counts = await planCleanup(conn);

    expect(counts).toEqual({ news_posts: 0 });
  });
});

describe("executeCleanup", () => {
  it("deletes herbots-sourced rows inside one transaction and commits", async () => {
    const calls = [];
    const conn = fakeConn((sql) => {
      calls.push(sql);
      return [{ affectedRows: 12 }];
    });

    const counts = await executeCleanup(conn);

    expect(counts).toEqual({ news_posts: 12 });
    expect(calls).toEqual(["DELETE FROM news_posts WHERE source = 'herbots'"]);
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  it("rolls back and never commits when the delete fails", async () => {
    const conn = fakeConn(() => {
      throw Object.assign(new Error("connection lost"), { code: "PROTOCOL_CONNECTION_LOST" });
    });

    await expect(executeCleanup(conn)).rejects.toThrow("connection lost");

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });
});
