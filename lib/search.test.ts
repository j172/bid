import { describe, expect, it } from "vitest";
import { tokenizeSearchQuery } from "./search";

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
