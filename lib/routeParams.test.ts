// The `[id]` path-segment parser 25 route handlers now share (issue #139
// M1). Pure, no I/O — same style as lib/listingValidation.test.ts.

import { describe, expect, it } from "vitest";
import { parseIdParam } from "./routeParams";

describe("parseIdParam", () => {
  it("accepts a plain positive integer id", () => {
    expect(parseIdParam("1")).toBe(1);
    expect(parseIdParam("42")).toBe(42);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseIdParam(" 7 ")).toBe(7);
  });

  it("rejects non-numeric segments", () => {
    expect(parseIdParam("abc")).toBeNull();
    expect(parseIdParam("12abc")).toBeNull();
    expect(parseIdParam("")).toBeNull();
    expect(parseIdParam("   ")).toBeNull();
  });

  it("rejects zero and negatives — no row ever has them", () => {
    expect(parseIdParam("0")).toBeNull();
    expect(parseIdParam("-1")).toBeNull();
  });

  it("rejects the numeric forms the old Number.isFinite check let through", () => {
    // Each of these used to reach the DB as a query parameter.
    expect(parseIdParam("1.5")).toBeNull();
    expect(parseIdParam("1e3")).toBeNull();
    expect(parseIdParam("0x10")).toBeNull();
    expect(parseIdParam("+1")).toBeNull();
    expect(parseIdParam("Infinity")).toBeNull();
  });

  it("rejects an id past the safe-integer range rather than silently rounding it", () => {
    expect(parseIdParam("9007199254740993")).toBeNull();
  });
});
