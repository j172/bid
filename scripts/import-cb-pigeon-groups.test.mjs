// Regression coverage for scripts/import-cb-pigeon-groups.mjs's pure parsing
// helpers, using real cb-pigeon.com pages saved as fixtures (fetched while
// building the script — see its own header comment for the markup shapes
// these cover, and issue #260's grill session, which specifically checked
// group/view/100's fields and embed-map coordinates by hand). Importing the
// module must NOT trigger a live crawl (see its `isMainModule` guard) —
// these tests run offline.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addressGeocodeCandidates,
  discoverGroupIds,
  extractGroupFromHtml,
  parseGoogleMapsEmbedCoordinates,
} from "./import-cb-pigeon-groups.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf8");
}

describe("discoverGroupIds", () => {
  it("finds every unique /group/view/{id} link on a regional listing page", () => {
    const html = loadFixture("cb-pigeon-group-n-list.html");
    const ids = discoverGroupIds(html);

    expect(ids.length).toBe(45);
    expect(new Set(ids).size).toBe(45); // no duplicates
    expect(ids.slice(0, 5)).toEqual(["5", "6", "8", "11", "15"]);
  });

  it("returns an empty array when there are no matching links", () => {
    expect(discoverGroupIds("<html><body>no groups here</body></html>")).toEqual([]);
  });
});

describe("parseGoogleMapsEmbedCoordinates", () => {
  it("parses lng/lat out of a modern Google Maps embed pb= URL (issue #260's documented group/view/100 example)", () => {
    const src =
      "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3622.0274751613665!2d121.02569270000001!3d24.7945127!3m2!1i1024!2i768!4f13.1";
    expect(parseGoogleMapsEmbedCoordinates(src)).toEqual({ lat: 24.7945127, lng: 121.02569270000001 });
  });

  it("returns null for a legacy maps.google.com.tw search-result redirect link (no !2d/!3d tokens)", () => {
    const src =
      "https://maps.google.com.tw/maps?f=q&source=s_q&hl=zh-TW&geocode=&q=address&sll=25.068651,121.63366&ll=25.1299,121.449223&z=14&output=embed";
    expect(parseGoogleMapsEmbedCoordinates(src)).toBeNull();
  });

  it("returns null for a legacy Street View panorama embed (uses !1d<lat>!2d<lng>, no !3d token)", () => {
    const src =
      "https://www.google.com/maps/embed?pb=!1m0!3m2!1szh-TW!2stw!4v1429528161165!6m8!1m7!1sk7zC0XmbeHaMZmKo-Dd8Jw!2m2!1d24.855219!2d121.221072!3f75.9!4f-7.8!5f0.78";
    expect(parseGoogleMapsEmbedCoordinates(src)).toBeNull();
  });

  it("returns null for a missing src", () => {
    expect(parseGoogleMapsEmbedCoordinates(null)).toBeNull();
    expect(parseGoogleMapsEmbedCoordinates(undefined)).toBeNull();
    expect(parseGoogleMapsEmbedCoordinates("")).toBeNull();
  });
});

describe("extractGroupFromHtml", () => {
  it("parses the canonical shape: chairman+phone and secretary+phone repeated in the free-text column, address/tracking-link only in the free text (group/view/100)", () => {
    const html = loadFixture("cb-pigeon-group-view-100.html");
    const group = extractGroupFromHtml(html);

    expect(group.name).toBe("新竹東區聯合會");
    expect(group.chairmanName).toBe("鄭永清");
    expect(group.chairmanPhone).toBe("03-577-5706、0932-118-369");
    expect(group.secretaryName).toBe("蔡燦龍");
    expect(group.secretaryPhone).toBe("03-534-0305、0952-196-180");
    expect(group.address).toBe("新竹縣竹東鎮竹美路二段101巷旁");
    expect(group.websiteUrl).toBe("http://www.bigwinner.idv.tw/pig_congress/east/east.html");
    expect(group.pigeonTrackingUrl).toBe("http://webfun.benzing.com.tw");
    expect(group.mapEmbedSrc).toContain("!2d121.02569270000001!3d24.7945127");
  });

  it("reads chairman name/phone from the structured left column, and falls back to the free text's differently-labeled address (group/view/105, '會址' not '地址')", () => {
    const html = loadFixture("cb-pigeon-group-view-105.html");
    const group = extractGroupFromHtml(html);

    expect(group.name).toBe("超級馬拉松鴿會");
    expect(group.chairmanName).toBe("鄒易余");
    expect(group.chairmanPhone).toBe("0932-111-333");
    expect(group.address).toBe("桃園市楊梅區");
    expect(group.websiteUrl).toBe("http://tw.myblog.yahoo.com/super-pigeon");
    expect(group.secretaryName).toBeNull();
    expect(group.pigeonTrackingUrl).toBeNull();
  });

  it("handles the 'surname/title before the label, value is a bare phone number' free-text shape, and only keeps the first of multiple 秘書 lines (group/view/114)", () => {
    const html = loadFixture("cb-pigeon-group-view-114.html");
    const group = extractGroupFromHtml(html);

    expect(group.name).toBe("薪苗鴿友聯合會");
    expect(group.chairmanName).toBe("盧會長");
    expect(group.chairmanPhone).toBe("0932-377-818");
    expect(group.address).toBe("新竹市中華路六段703號");
    expect(group.secretaryName).toBe("王秘書");
    expect(group.secretaryPhone).toBe("0910-785-884");
    expect(group.pigeonTrackingUrl).toBe("http://www.topigeon.com.tw/");
  });

  it("falls back entirely to the structured left column when the free-text column is empty (group/view/16)", () => {
    const html = loadFixture("cb-pigeon-group-view-16.html");
    const group = extractGroupFromHtml(html);

    expect(group.name).toBe("北海岸海翔聯誼會(新北市八里區)");
    expect(group.chairmanName).toBe("蔡詩祥");
    expect(group.chairmanPhone).toBe("0975-170656");
    expect(group.address).toBe("新北市八里區龍形一街33巷10號");
    expect(group.secretaryName).toBeNull();
    expect(group.websiteUrl).toBeNull();
    expect(group.pigeonTrackingUrl).toBeNull();
    // Legacy maps.google.com.tw link — parseGoogleMapsEmbedCoordinates(...)
    // correctly returns null for this (see its own tests above); this
    // group's coordinates would come from the Nominatim fallback in main().
    expect(group.mapEmbedSrc).toContain("maps.google.com.tw/maps");
  });

  it("returns an empty name (not a throw) when the expected container is missing", () => {
    const group = extractGroupFromHtml("<html><body>not a group page</body></html>");
    expect(group.name).toBe("");
    expect(group.chairmanName).toBeNull();
    expect(group.address).toBeNull();
  });
});

describe("addressGeocodeCandidates", () => {
  it("peels off trailing 巷/號 tokens one at a time, coarsest last", () => {
    const candidates = addressGeocodeCandidates("新北市八里區龍形一街33巷10號");
    expect(candidates).toEqual(["新北市八里區龍形一街33巷10號", "新北市八里區龍形一街33巷", "新北市八里區龍形一街"]);
  });

  it("returns just the address unchanged when there is no trailing house-number-shaped token", () => {
    // Ends in "旁" (beside/near), not a bare 號/弄/巷/段 token — group/view/100's
    // real address, confirmed during issue #260's grill session.
    expect(addressGeocodeCandidates("新竹縣竹東鎮竹美路二段101巷旁")).toEqual(["新竹縣竹東鎮竹美路二段101巷旁"]);
  });
});
