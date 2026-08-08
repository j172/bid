import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  canonicalListingsUrl,
  canonicalUrl,
  hreflangAlternates,
  localizedUrls,
  truncateForMetaDescription,
} from "./seo";

describe("truncateForMetaDescription", () => {
  it("returns short text unchanged", () => {
    expect(truncateForMetaDescription("A short listing.")).toBe("A short listing.");
  });

  it("collapses internal whitespace/newlines", () => {
    expect(truncateForMetaDescription("Line one\n\n  Line two")).toBe("Line one Line two");
  });

  it("truncates long text on a word boundary and appends an ellipsis", () => {
    const text = "word ".repeat(50).trim();
    const result = truncateForMetaDescription(text, 40);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith(" …")).toBe(false);
  });

  it("hard-truncates a single very long word with no safe space boundary", () => {
    const text = "a".repeat(200);
    const result = truncateForMetaDescription(text, 40);
    expect(result).toBe(`${"a".repeat(40)}…`);
  });
});

describe("absoluteUrl", () => {
  it("joins SITE_URL with a pathname that starts with /", () => {
    expect(absoluteUrl("/listings/5")).toBe("https://bid.j172.tw/listings/5");
  });

  it("adds a leading slash if the pathname is missing one", () => {
    expect(absoluteUrl("listings/5")).toBe("https://bid.j172.tw/listings/5");
  });
});

describe("localizedUrls", () => {
  it("returns one absolute URL per routing locale, zh-TW unprefixed", () => {
    const urls = localizedUrls("/listings/5");
    expect(urls).toEqual({
      "zh-TW": "https://bid.j172.tw/listings/5",
      "zh-CN": "https://bid.j172.tw/zh-CN/listings/5",
      en: "https://bid.j172.tw/en/listings/5",
    });
  });

  it("preserves query params in every locale's URL", () => {
    const urls = localizedUrls("/listings", { type: "auction" });
    expect(urls["zh-TW"]).toBe("https://bid.j172.tw/listings?type=auction");
    expect(urls["zh-CN"]).toBe("https://bid.j172.tw/zh-CN/listings?type=auction");
    expect(urls.en).toBe("https://bid.j172.tw/en/listings?type=auction");
  });

  it("handles the homepage path", () => {
    const urls = localizedUrls("/");
    expect(urls["zh-TW"]).toBe("https://bid.j172.tw/");
    expect(urls["zh-CN"]).toBe("https://bid.j172.tw/zh-CN");
    expect(urls.en).toBe("https://bid.j172.tw/en");
  });
});

describe("hreflangAlternates", () => {
  it("includes every locale plus an x-default pointing at the default locale's URL", () => {
    const alternates = hreflangAlternates("/contact");
    expect(alternates["zh-TW"]).toBe("https://bid.j172.tw/contact");
    expect(alternates["zh-CN"]).toBe("https://bid.j172.tw/zh-CN/contact");
    expect(alternates.en).toBe("https://bid.j172.tw/en/contact");
    expect(alternates["x-default"]).toBe(alternates["zh-TW"]);
  });
});

describe("canonicalListingsUrl", () => {
  it("drops cosmetic/view-only params (sort, q, perf, minPrice, ...)", () => {
    expect(
      canonicalListingsUrl("zh-TW", {
        sort: "price_asc",
        q: "search term",
        perf: "aggressive",
        minPrice: "100",
        maxPrice: "500",
        withinHours: "24",
        loft: "3",
      }),
    ).toBe("https://bid.j172.tw/listings");
  });

  it("keeps the `type` param since it changes the listing set shown", () => {
    expect(canonicalListingsUrl("zh-TW", { type: "auction", sort: "price_asc" })).toBe(
      "https://bid.j172.tw/listings?type=auction",
    );
  });

  it("ignores an unrecognized type value", () => {
    expect(canonicalListingsUrl("zh-TW", { type: "not-a-real-type" })).toBe("https://bid.j172.tw/listings");
  });

  it("builds locale-prefixed canonical URLs for non-default locales", () => {
    expect(canonicalListingsUrl("en", { type: "fixed_price" })).toBe(
      "https://bid.j172.tw/en/listings?type=fixed_price",
    );
  });

  it("takes the first value when a param is passed as an array", () => {
    expect(canonicalListingsUrl("zh-TW", { type: ["auction", "fixed_price"] })).toBe(
      "https://bid.j172.tw/listings?type=auction",
    );
  });
});

describe("canonicalUrl", () => {
  it("builds a plain absolute canonical URL for the default locale", () => {
    expect(canonicalUrl("zh-TW", "/contact")).toBe("https://bid.j172.tw/contact");
  });

  it("builds a locale-prefixed canonical URL for a non-default locale", () => {
    expect(canonicalUrl("en", "/contact")).toBe("https://bid.j172.tw/en/contact");
  });
});
