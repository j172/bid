// Shared search/county/pagination UI state for the pigeon-shops,
// pigeon-stations, and pigeon-groups directory explorer components (issue
// #275). All three previously kept independent, near-identical `useState`
// calls for search text and county filter; pagination adds two more fields
// (page, pageSize) that must reset back to page 1 whenever the search text,
// county filter, or page size itself changes — otherwise a user could be
// left staring at an empty page 4 after their search shrinks the result set
// to one page. A single reducer makes that reset one pure, testable
// transition instead of three separately-remembered `setPage(1)` call sites.

import { ALL_COUNTIES_VALUE } from "@/lib/pigeonDirectoryFilters";

// Mirrors lib/news.ts's NEWS_PAGE_SIZES / DEFAULT_NEWS_PAGE_SIZE convention
// (also used by lib/pigeonShowcase.ts) — issue #275 asks the three directory
// pages to follow the same 30/50/100, default-30 shape.
export const PIGEON_DIRECTORY_PAGE_SIZES = [30, 50, 100] as const;
export type PigeonDirectoryPageSize = (typeof PIGEON_DIRECTORY_PAGE_SIZES)[number];
export const DEFAULT_PIGEON_DIRECTORY_PAGE_SIZE: PigeonDirectoryPageSize = 30;

export function isPigeonDirectoryPageSize(value: number): value is PigeonDirectoryPageSize {
  return (PIGEON_DIRECTORY_PAGE_SIZES as readonly number[]).includes(value);
}

export interface DirectoryListState {
  searchQuery: string;
  county: string;
  /** 1-based. */
  page: number;
  pageSize: PigeonDirectoryPageSize;
}

export const INITIAL_DIRECTORY_LIST_STATE: DirectoryListState = {
  searchQuery: "",
  county: ALL_COUNTIES_VALUE,
  page: 1,
  pageSize: DEFAULT_PIGEON_DIRECTORY_PAGE_SIZE,
};

export type DirectoryListAction =
  | { type: "search"; value: string }
  | { type: "county"; value: string }
  | { type: "pageSize"; value: PigeonDirectoryPageSize }
  | { type: "page"; value: number };

/**
 * Search text, county filter, and pagination state for one directory
 * explorer page. Changing the search text, the county filter, or the page
 * size always jumps back to page 1 (issue #275's spec); only an explicit
 * page-change action leaves the other fields untouched.
 */
export function directoryListReducer(state: DirectoryListState, action: DirectoryListAction): DirectoryListState {
  switch (action.type) {
    case "search":
      return { ...state, searchQuery: action.value, page: 1 };
    case "county":
      return { ...state, county: action.value, page: 1 };
    case "pageSize":
      return { ...state, pageSize: action.value, page: 1 };
    case "page":
      return { ...state, page: action.value };
    default:
      return state;
  }
}
