import { describe, expect, it } from "vitest";
import {
  DEFAULT_PIGEON_DIRECTORY_PAGE_SIZE,
  INITIAL_DIRECTORY_LIST_STATE,
  PIGEON_DIRECTORY_PAGE_SIZES,
  directoryListReducer,
  isPigeonDirectoryPageSize,
  type DirectoryListState,
} from "./pigeonDirectoryListState";
import { ALL_COUNTIES_VALUE } from "./pigeonDirectoryFilters";

const midListState: DirectoryListState = {
  searchQuery: "屏東",
  county: "屏東縣",
  page: 4,
  pageSize: 50,
};

describe("directoryListReducer", () => {
  it("resets to page 1 when the search query changes", () => {
    expect(directoryListReducer(midListState, { type: "search", value: "新搜尋" })).toEqual({
      ...midListState,
      searchQuery: "新搜尋",
      page: 1,
    });
  });

  it("resets to page 1 when the county changes", () => {
    expect(directoryListReducer(midListState, { type: "county", value: "台北市" })).toEqual({
      ...midListState,
      county: "台北市",
      page: 1,
    });
  });

  it("resets to page 1 when the page size changes", () => {
    expect(directoryListReducer(midListState, { type: "pageSize", value: 100 })).toEqual({
      ...midListState,
      pageSize: 100,
      page: 1,
    });
  });

  it("changes only the page for an explicit page action, leaving filters/pageSize untouched", () => {
    expect(directoryListReducer(midListState, { type: "page", value: 2 })).toEqual({
      ...midListState,
      page: 2,
    });
  });

  it("starts from ALL_COUNTIES_VALUE, empty search, page 1, and the default page size", () => {
    expect(INITIAL_DIRECTORY_LIST_STATE).toEqual({
      searchQuery: "",
      county: ALL_COUNTIES_VALUE,
      page: 1,
      pageSize: DEFAULT_PIGEON_DIRECTORY_PAGE_SIZE,
    });
  });
});

describe("isPigeonDirectoryPageSize", () => {
  it("accepts every value in PIGEON_DIRECTORY_PAGE_SIZES", () => {
    for (const size of PIGEON_DIRECTORY_PAGE_SIZES) {
      expect(isPigeonDirectoryPageSize(size)).toBe(true);
    }
  });

  it("rejects values outside the allowed set", () => {
    expect(isPigeonDirectoryPageSize(10)).toBe(false);
    expect(isPigeonDirectoryPageSize(0)).toBe(false);
    expect(isPigeonDirectoryPageSize(Number.NaN)).toBe(false);
  });
});
