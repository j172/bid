import { describe, expect, it } from "vitest";
import { parseCountyFromAddress, TAIWAN_COUNTY_ORDER } from "./taiwanCounty";

describe("parseCountyFromAddress", () => {
  it("returns null for null/undefined/empty/whitespace-only input without throwing", () => {
    expect(parseCountyFromAddress(null)).toBeNull();
    expect(parseCountyFromAddress(undefined)).toBeNull();
    expect(parseCountyFromAddress("")).toBeNull();
    expect(parseCountyFromAddress("   ")).toBeNull();
  });

  it("parses a county/city name given directly at the start of the address", () => {
    expect(parseCountyFromAddress("屏東縣屏東市福州街82號")).toBe("屏東縣");
    expect(parseCountyFromAddress("新北市三重區重新路一段")).toBe("新北市");
    expect(parseCountyFromAddress("高雄市苓雅區四維三路")).toBe("高雄市");
  });

  it("tolerates the 台/臺 spelling variant and normalizes to the 台 form", () => {
    expect(parseCountyFromAddress("臺北市信義區松仁路")).toBe("台北市");
    expect(parseCountyFromAddress("台北市信義區松仁路")).toBe("台北市");
    expect(parseCountyFromAddress("臺中市西屯區")).toBe("台中市");
    expect(parseCountyFromAddress("臺南市安平區")).toBe("台南市");
    expect(parseCountyFromAddress("臺東縣臺東市")).toBe("台東縣");
  });

  it("skips a leading postal code before the county/city name", () => {
    expect(parseCountyFromAddress("900屏東縣屏東市福州街82號")).toBe("屏東縣");
    expect(parseCountyFromAddress("900 屏東縣屏東市福州街82號")).toBe("屏東縣");
    expect(parseCountyFromAddress("80641 高雄市楠梓區")).toBe("高雄市");
    expect(parseCountyFromAddress("800-51 高雄市新興區")).toBe("高雄市");
  });

  it("skips a leading 台灣/臺灣 country prefix", () => {
    expect(parseCountyFromAddress("台灣新竹縣竹北市")).toBe("新竹縣");
    expect(parseCountyFromAddress("臺灣 300 新竹市東區")).toBe("新竹市");
  });

  it("distinguishes 新竹市 from 新竹縣 and 嘉義市 from 嘉義縣", () => {
    expect(parseCountyFromAddress("新竹市東區光復路")).toBe("新竹市");
    expect(parseCountyFromAddress("新竹縣竹北市光明六路")).toBe("新竹縣");
    expect(parseCountyFromAddress("嘉義市東區")).toBe("嘉義市");
    expect(parseCountyFromAddress("嘉義縣水上鄉")).toBe("嘉義縣");
  });

  it("parses every outlying-island county", () => {
    expect(parseCountyFromAddress("澎湖縣馬公市")).toBe("澎湖縣");
    expect(parseCountyFromAddress("金門縣金城鎮")).toBe("金門縣");
    expect(parseCountyFromAddress("連江縣南竿鄉")).toBe("連江縣");
  });

  // Real address shapes seen in scripts/import-pigeon-stations.mjs's source
  // data: a bare district name with no leading county/city at all. This
  // module deliberately doesn't maintain a district->county table (see its
  // header comment) — an address like this should come back null, not throw
  // and not guess.
  it("returns null for a bare district name with no county/city prefix", () => {
    expect(parseCountyFromAddress("三重區河邊北街166號")).toBeNull();
    expect(parseCountyFromAddress("水上鄉北回歸線上")).toBeNull();
  });

  it("returns null for an address that matches no known county/city", () => {
    expect(parseCountyFromAddress("火星市第一街1號")).toBeNull();
    expect(parseCountyFromAddress("福州街82號")).toBeNull();
  });

  it("does not match a county name that only appears well past the leading window", () => {
    const padded = "X".repeat(30) + "台北市信義區";
    expect(parseCountyFromAddress(padded)).toBeNull();
  });

  it("TAIWAN_COUNTY_ORDER lists all 22 counties/cities with no duplicates", () => {
    expect(TAIWAN_COUNTY_ORDER).toHaveLength(22);
    expect(new Set(TAIWAN_COUNTY_ORDER).size).toBe(22);
  });

  it("every county in TAIWAN_COUNTY_ORDER is parseable from its own bare name", () => {
    for (const county of TAIWAN_COUNTY_ORDER) {
      expect(parseCountyFromAddress(`${county}某某路1號`)).toBe(county);
    }
  });
});
