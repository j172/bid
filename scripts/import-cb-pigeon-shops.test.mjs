// Regression coverage for scripts/import-cb-pigeon-shops.mjs's pure parsing
// helpers, using real cb-pigeon.com pages saved as fixtures (fetched while
// building the script). Importing the module must NOT trigger a live crawl
// (see its `isMainModule` guard) — these tests run offline.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  discoverCategoryLinksFromNavHtml,
  extractShopFromDetailHtml,
  extractShopIdsFromCategoryHtml,
  normalizePhoneForComparison,
  parseGoogleMapsIframeCoords,
  phonesMatch,
} from "./import-cb-pigeon-shops.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf8");
}

describe("discoverCategoryLinksFromNavHtml", () => {
  it("parses every /store/{region}/{catId} category link on the region nav page, without a hardcoded id list", () => {
    const html = loadFixture("cb-pigeon-store-n.html");
    const categories = discoverCategoryLinksFromNavHtml(html, "n");

    // Matches the issue's stated fact: region n currently has 3 categories.
    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.id).sort()).toEqual(["3", "5", "6"]);
    expect(categories).toContainEqual({
      id: "3",
      region: "n",
      label: "賽鴿飼料-台北地區",
      url: "https://www.cb-pigeon.com/store/n/3",
    });
  });

  it("dedupes a category id linked more than once on the same nav page", () => {
    const html = `
      <a href="/store/n/3">賽鴿飼料-台北地區</a>
      <a href="/store/n/3">賽鴿飼料-台北地區 (again)</a>
    `;
    expect(discoverCategoryLinksFromNavHtml(html, "n")).toHaveLength(1);
  });

  it("ignores links for a different region", () => {
    const html = `<a href="/store/w/4">賽鴿飼料-苗栗地區</a>`;
    expect(discoverCategoryLinksFromNavHtml(html, "n")).toEqual([]);
  });

  it("returns an empty array when the page has no category links", () => {
    expect(discoverCategoryLinksFromNavHtml("<html><body>empty</body></html>", "n")).toEqual([]);
  });
});

describe("extractShopIdsFromCategoryHtml", () => {
  it("parses every /store/view/{id} link on a category page, in document order, deduped", () => {
    const html = loadFixture("cb-pigeon-store-n-3.html");
    const ids = extractShopIdsFromCategoryHtml(html);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids[0]).toBe(4);
    expect(ids).toContain(10);
    // No duplicates even though the same shop id could theoretically be
    // linked more than once on a listing page.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns an empty array when there are no shop links", () => {
    expect(extractShopIdsFromCategoryHtml("<html><body>no shops</body></html>")).toEqual([]);
  });
});

describe("parseGoogleMapsIframeCoords", () => {
  it("parses ll=<lat>,<lng> from a real embedded Google Maps iframe src (human-verified store/view/10)", () => {
    // Matches the issue's own worked example exactly: ll=25.077242,121.524067
    // for 111 台北市士林區文林路524號.
    const src =
      "https://maps.google.com.tw/maps?q=+111+%E5%8F%B0%E5%8C%97%E5%B8%82%E5%A3%AB%E6%9E%97%E5%8D%80%E6%96%87%E6%9E%97%E8%B7%AF524%E8%99%9F&layer=c&sll=25.097091,121.524170&cbll=25.097089,121.524061&ll=25.077242,121.524067&spn=0.022467,0.04549&z=14";
    expect(parseGoogleMapsIframeCoords(src)).toEqual({ lat: 25.077242, lng: 121.524067 });
  });

  it("falls back to sll, then cbll, when ll is absent", () => {
    expect(parseGoogleMapsIframeCoords("https://maps.google.com.tw/maps?sll=25.1,121.5")).toEqual({
      lat: 25.1,
      lng: 121.5,
    });
    expect(parseGoogleMapsIframeCoords("https://maps.google.com.tw/maps?cbll=24.9,120.9")).toEqual({
      lat: 24.9,
      lng: 120.9,
    });
  });

  it("returns null when none of ll/sll/cbll are present", () => {
    expect(parseGoogleMapsIframeCoords("https://maps.google.com.tw/maps?q=somewhere")).toBeNull();
  });

  it("returns null for a missing/empty src", () => {
    expect(parseGoogleMapsIframeCoords(null)).toBeNull();
    expect(parseGoogleMapsIframeCoords("")).toBeNull();
  });

  it("returns null for an unparseable URL", () => {
    expect(parseGoogleMapsIframeCoords("not a url at all ::")).toBeNull();
  });

  it("rejects an out-of-range lat/lng instead of returning nonsense coordinates", () => {
    expect(parseGoogleMapsIframeCoords("https://maps.google.com.tw/maps?ll=200,500")).toBeNull();
  });
});

describe("extractShopFromDetailHtml", () => {
  it("parses category/name/contact/phone/address and the embedded map coords from a real detail page", () => {
    const html = loadFixture("cb-pigeon-view-10.html");
    const shop = extractShopFromDetailHtml(html);

    expect(shop).toEqual({
      category: "賽鴿飼料-台北地區",
      name: "宏偉鴿園 -士林區",
      contact: "宏偉鴿園",
      phone: "02-2831 9377",
      address: "111 台北市士林區文林路524號",
      mapCoords: { lat: 25.077242, lng: 121.524067 },
    });
  });

  it("handles a real page with no embedded map at all (no address on file)", () => {
    // /store/view/24: a live source data-quality issue — its 地址 line
    // actually contains a phone number, and it has no map iframe. Must not
    // throw; mapCoords is simply null and the garbled text passes through
    // verbatim, same as this project's stance on nicepigeon's occasional
    // missing/odd fields.
    const html = loadFixture("cb-pigeon-view-24.html");
    const shop = extractShopFromDetailHtml(html);

    expect(shop.name).toBe("賽鴿");
    expect(shop.contact).toBe("賴永欽");
    expect(shop.phone).toBe("02-26813737");
    expect(shop.mapCoords).toBeNull();
  });

  it("returns null when the page doesn't look like a shop detail page", () => {
    expect(extractShopFromDetailHtml("<html><body>not a shop page</body></html>")).toBeNull();
  });
});

describe("normalizePhoneForComparison", () => {
  it("strips whitespace and dashes", () => {
    expect(normalizePhoneForComparison("02-2831 9377")).toBe("0228319377");
  });

  it("folds fullwidth digits/dashes/space to halfwidth before stripping", () => {
    expect(normalizePhoneForComparison("０２－２８３１　９３７７")).toBe("0228319377");
  });

  it("strips parentheses (e.g. area code parens)", () => {
    expect(normalizePhoneForComparison("(02) 2831-9377")).toBe("0228319377");
  });

  it("returns an empty string for null/empty input", () => {
    expect(normalizePhoneForComparison(null)).toBe("");
    expect(normalizePhoneForComparison("")).toBe("");
  });
});

describe("phonesMatch", () => {
  it("matches equivalent phone numbers written differently", () => {
    expect(phonesMatch("02-2831 9377", "０２－２８３１－９３７７")).toBe(true);
  });

  it("does not match different phone numbers", () => {
    expect(phonesMatch("02-2831 9377", "02-2831 9378")).toBe(false);
  });

  it("never matches when either side is null/empty, even to itself", () => {
    expect(phonesMatch(null, null)).toBe(false);
    expect(phonesMatch("", "")).toBe(false);
    expect(phonesMatch(null, "02-2831 9377")).toBe(false);
  });
});
