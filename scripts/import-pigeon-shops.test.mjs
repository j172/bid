// Regression coverage for scripts/import-pigeon-shops.mjs's pure parsing
// helpers, using two real nicepigeon.com detail pages saved as fixtures
// (fetched while building the script — see its own header comment for the
// two markup shapes these cover). Importing the module must NOT trigger a
// live crawl (see its `isMainModule` guard) — these tests run offline.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { addressGeocodeCandidates, extractShopsFromHtml } from "./import-pigeon-shops.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf8");
}

describe("extractShopsFromHtml", () => {
  it("parses Format A (name/電話/地址 all in one <p>, <br>-separated)", () => {
    const html = loadFixture("pigeon-shops-detail-667.html");
    const shops = extractShopsFromHtml(html);

    expect(shops.length).toBe(30);
    expect(shops[0]).toEqual({
      name: "愛鴿之家(屏東市)",
      phone: "08-7321674",
      address: "900 屏東市福州街82號",
    });

    // 賽鴿競翔聯誼 and 馥堂鴿園 have a phone but no address in the source —
    // must still come through, with address left null rather than dropped.
    const missingAddress = shops.filter((shop) => !shop.address);
    expect(missingAddress.map((shop) => shop.name)).toEqual(["賽鴿競翔聯誼", "馥堂鴿園"]);
    expect(missingAddress.every((shop) => shop.phone)).toBe(true);
  });

  it("parses Format B (name+電話 in one <p>, 地址 in a separate <p>, with district sub-headers)", () => {
    const html = loadFixture("pigeon-shops-detail-286.html");
    const shops = extractShopsFromHtml(html);

    expect(shops.length).toBe(16);
    // First shop, under the 【南港區】 sub-header, which must be skipped
    // rather than parsed as a shop name.
    expect(shops[0]).toEqual({
      name: "中南鴿園",
      phone: "02-2652 1272",
      address: "115 台北市南港區中南街35號",
    });
    expect(shops.some((shop) => shop.name.includes("【"))).toBe(false);
  });

  it("returns an empty array when the expected container is missing", () => {
    expect(extractShopsFromHtml("<html><body>no shops here</body></html>")).toEqual([]);
  });
});

describe("addressGeocodeCandidates", () => {
  it("peels off a trailing house number as the first fallback", () => {
    expect(addressGeocodeCandidates("900 屏東市福州街82號")).toEqual([
      "900 屏東市福州街82號",
      "900 屏東市福州街",
    ]);
  });

  it("peels off 段/巷/弄/號 tokens one at a time, coarsest last", () => {
    const candidates = addressGeocodeCandidates("104 台北市中山區民族東路240巷10弄2號");
    expect(candidates[0]).toBe("104 台北市中山區民族東路240巷10弄2號");
    expect(candidates[candidates.length - 1]).toBe("104 台北市中山區民族東路");
    // Every step must be strictly shorter than the last (monotonically
    // coarsening, no infinite loop / no-op steps).
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].length).toBeLessThan(candidates[i - 1].length);
    }
  });

  it("returns just the address unchanged when there is no trailing number to strip", () => {
    expect(addressGeocodeCandidates("屏東市福州街")).toEqual(["屏東市福州街"]);
  });
});
