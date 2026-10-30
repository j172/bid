import { describe, expect, it } from "vitest";
import { buildKeywordSearch, tokenizeSearchQuery } from "./search";

describe("tokenizeSearchQuery", () => {
  it("returns a single keyword unchanged", () => {
    expect(tokenizeSearchQuery("石君")).toEqual(["石君"]);
  });

  it("segments a multi-keyword query with spaces into separate tokens", () => {
    expect(tokenizeSearchQuery("石君 回血")).toEqual(["石君", "回血"]);
  });

  it("returns an empty array for punctuation-only input", () => {
    expect(tokenizeSearchQuery("！？，。")).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(tokenizeSearchQuery("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(tokenizeSearchQuery("   ")).toEqual([]);
  });

  it("deduplicates repeated tokens", () => {
    expect(tokenizeSearchQuery("石君 石君")).toEqual(["石君"]);
  });

  it("segments English words on whitespace too", () => {
    expect(tokenizeSearchQuery("hello world")).toEqual(["hello", "world"]);
  });
});

describe("buildKeywordSearch", () => {
  const columns = ["l.title", "l.description"] as const;
  const options = { columns, rankColumn: "l.title" };

  it("produces nothing to AND in when there is no search", () => {
    for (const empty of [undefined, "", "   "]) {
      expect(buildKeywordSearch(empty, options)).toEqual({
        conditions: [],
        params: [],
        // Callers interpolate rankPrefix unconditionally, so the no-search
        // case has to leave their ORDER BY untouched.
        rankPrefix: "",
        rankParams: [],
      });
    }
  });

  it("AND's one per-keyword condition per segmented token", () => {
    const { conditions, params } = buildKeywordSearch("石君 回血", options);

    expect(conditions).toEqual([
      "(l.title LIKE ? OR l.description LIKE ?)",
      "(l.title LIKE ? OR l.description LIKE ?)",
    ]);
    expect(params).toEqual(["%石君%", "%石君%", "%回血%", "%回血%"]);
  });

  it("emits one bind param per column so conditions and params stay aligned", () => {
    const { params } = buildKeywordSearch("石君", { columns: ["a", "b", "c"], rankColumn: "a" });
    expect(params).toEqual(["%石君%", "%石君%", "%石君%"]);
  });

  it("falls back to the whole trimmed query when segmentation yields no tokens", () => {
    // All-punctuation input tokenizes to nothing; dropping the filter here
    // would silently return every row instead of searching.
    const { conditions, params } = buildKeywordSearch("  ！？  ", options);

    expect(conditions).toEqual(["(l.title LIKE ? OR l.description LIKE ?)"]);
    expect(params).toEqual(["%！？%", "%！？%"]);
  });

  it("ranks whole-query matches ahead of keyword-only matches", () => {
    const { rankPrefix, rankParams } = buildKeywordSearch("石君 回血", options);

    expect(`${rankPrefix}l.ends_at DESC`).toBe("CASE WHEN l.title LIKE ? THEN 0 ELSE 1 END, l.ends_at DESC");
    expect(rankParams).toEqual(["%石君 回血%"]);
  });
});
