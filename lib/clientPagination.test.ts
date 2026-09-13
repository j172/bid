import { describe, expect, it } from "vitest";
import { paginateClientList } from "./clientPagination";

const ITEMS = Array.from({ length: 95 }, (_, i) => i + 1);

describe("paginateClientList", () => {
  it("slices the first page", () => {
    const result = paginateClientList(ITEMS, 1, 30);
    expect(result).toEqual({ page: 1, totalPages: 4, items: ITEMS.slice(0, 30) });
  });

  it("slices a middle page", () => {
    const result = paginateClientList(ITEMS, 2, 30);
    expect(result.items).toEqual(ITEMS.slice(30, 60));
    expect(result.page).toBe(2);
  });

  it("slices a partial last page", () => {
    const result = paginateClientList(ITEMS, 4, 30);
    expect(result.items).toEqual(ITEMS.slice(90, 95));
    expect(result.totalPages).toBe(4);
  });

  it("clamps a page beyond the last page down to the last page", () => {
    const result = paginateClientList(ITEMS, 99, 30);
    expect(result.page).toBe(4);
    expect(result.items).toEqual(ITEMS.slice(90, 95));
  });

  it("clamps a page below 1 up to page 1", () => {
    expect(paginateClientList(ITEMS, 0, 30).page).toBe(1);
    expect(paginateClientList(ITEMS, -3, 30).page).toBe(1);
  });

  it("treats an empty list as a single empty page", () => {
    expect(paginateClientList([], 1, 30)).toEqual({ page: 1, totalPages: 1, items: [] });
  });

  it("returns everything on one page when pageSize exceeds the list length", () => {
    const result = paginateClientList(ITEMS, 1, 200);
    expect(result).toEqual({ page: 1, totalPages: 1, items: ITEMS });
  });
});
