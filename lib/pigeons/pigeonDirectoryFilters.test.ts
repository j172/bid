import { describe, expect, it } from "vitest";
import { ALL_COUNTIES_VALUE, filterPigeonDirectoryEntries, listPresentCounties } from "./pigeonDirectoryFilters";

interface Entry {
  id: number;
  name: string;
  address: string | null;
}

function entry(overrides: Partial<Entry> & { id: number }): Entry {
  return { name: "鴿店", address: null, ...overrides };
}

const ROWS: Entry[] = [
  entry({ id: 1, name: "屏東鴿坊", address: "屏東縣屏東市福州街82號" }),
  entry({ id: 2, name: "台北賽鴿中心", address: "台北市信義區松仁路1號" }),
  entry({ id: 3, name: "阿明鴿舍", address: "屏東縣潮州鎮中山路5號" }),
  entry({ id: 4, name: "無地址店家", address: null }),
  entry({ id: 5, name: "神秘地址店家", address: "三重區河邊北街166號" }), // unclassified
];

describe("filterPigeonDirectoryEntries", () => {
  it("returns every entry when no criteria are given", () => {
    expect(filterPigeonDirectoryEntries(ROWS, {})).toHaveLength(5);
  });

  it("filters by case-insensitive name/address substring search", () => {
    expect(filterPigeonDirectoryEntries(ROWS, { searchQuery: "屏東" }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterPigeonDirectoryEntries(ROWS, { searchQuery: "台北賽鴿" }).map((r) => r.id)).toEqual([2]);
  });

  it("treats a blank/whitespace-only search as no search", () => {
    expect(filterPigeonDirectoryEntries(ROWS, { searchQuery: "   " })).toHaveLength(5);
  });

  it("does not crash on a null address when searching", () => {
    expect(filterPigeonDirectoryEntries(ROWS, { searchQuery: "無地址店家" }).map((r) => r.id)).toEqual([4]);
  });

  it("filters by county", () => {
    expect(filterPigeonDirectoryEntries(ROWS, { county: "屏東縣" }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterPigeonDirectoryEntries(ROWS, { county: "台北市" }).map((r) => r.id)).toEqual([2]);
  });

  it("excludes null-address and unclassified-address rows once a county is selected", () => {
    const result = filterPigeonDirectoryEntries(ROWS, { county: "屏東縣" });
    expect(result.map((r) => r.id)).not.toContain(4);
    expect(result.map((r) => r.id)).not.toContain(5);
  });

  it("treats ALL_COUNTIES_VALUE the same as no county filter", () => {
    expect(filterPigeonDirectoryEntries(ROWS, { county: ALL_COUNTIES_VALUE })).toHaveLength(5);
  });

  it("combines search and county with AND logic", () => {
    expect(filterPigeonDirectoryEntries(ROWS, { searchQuery: "阿明", county: "屏東縣" }).map((r) => r.id)).toEqual([3]);
    expect(filterPigeonDirectoryEntries(ROWS, { searchQuery: "台北賽鴿", county: "屏東縣" })).toEqual([]);
  });
});

describe("listPresentCounties", () => {
  it("lists only counties that actually occur, in TAIWAN_COUNTY_ORDER order", () => {
    expect(listPresentCounties(ROWS)).toEqual(["台北市", "屏東縣"]);
  });

  it("returns an empty array when nothing is classifiable", () => {
    expect(listPresentCounties([entry({ id: 1, address: null }), entry({ id: 2, address: "三重區" })])).toEqual([]);
  });

  it("returns an empty array for an empty list", () => {
    expect(listPresentCounties([])).toEqual([]);
  });
});
