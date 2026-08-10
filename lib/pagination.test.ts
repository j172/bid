import { describe, expect, it } from "vitest";
import { paginate } from "./pagination";

describe("paginate", () => {
  it("defaults to the first page", () => {
    expect(paginate(undefined, 50)).toEqual({ page: 1, offset: 0, limit: 50 });
  });

  it("derives the offset from the page and page size", () => {
    expect(paginate(3, 50)).toEqual({ page: 3, offset: 100, limit: 50 });
    expect(paginate(2, 30)).toEqual({ page: 2, offset: 30, limit: 30 });
  });

  it("clamps out-of-range pages to the first page rather than a negative offset", () => {
    expect(paginate(0, 50)).toEqual({ page: 1, offset: 0, limit: 50 });
    expect(paginate(-7, 50)).toEqual({ page: 1, offset: 0, limit: 50 });
  });

  it("normalizes fractional and NaN pages to whole pages", () => {
    // Query-string input reaches these helpers via Number(), so a junk
    // ?page= value must not become a fractional OFFSET (a SQL syntax error
    // once interpolated).
    expect(paginate(2.7, 50)).toEqual({ page: 2, offset: 50, limit: 50 });
    expect(paginate(Number.NaN, 50)).toEqual({ page: 1, offset: 0, limit: 50 });
  });
});
