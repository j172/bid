import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  buildBreadcrumbListJsonLd,
  buildFaqPageJsonLd,
  buildListingProductJsonLd,
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildNewsArticleJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  canonicalListingsUrl,
  canonicalUrl,
  hreflangAlternates,
  type ListingJsonLdInput,
  localizedUrls,
  stripHtmlToPlainText,
  truncateForMetaDescription,
} from "./seo";

describe("stripHtmlToPlainText", () => {
  it("removes tags and keeps the text content", () => {
    expect(stripHtmlToPlainText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("collapses whitespace left behind by block-level tags", () => {
    expect(stripHtmlToPlainText("<p>Line one</p><p>Line two</p>")).toBe("Line one Line two");
  });

  it("drops disallowed tags entirely, including their content for script/style", () => {
    expect(stripHtmlToPlainText('<img src="x.jpg" alt="ignored" />plain text')).toBe("plain text");
  });
});

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
    expect(absoluteUrl("/listings/5")).toBe("https://xiangshuicn.cc/listings/5");
  });

  it("adds a leading slash if the pathname is missing one", () => {
    expect(absoluteUrl("listings/5")).toBe("https://xiangshuicn.cc/listings/5");
  });
});

describe("localizedUrls", () => {
  it("returns one absolute URL per routing locale, zh-TW unprefixed", () => {
    const urls = localizedUrls("/listings/5");
    expect(urls).toEqual({
      "zh-TW": "https://xiangshuicn.cc/listings/5",
      "zh-CN": "https://xiangshuicn.cc/zh-CN/listings/5",
      en: "https://xiangshuicn.cc/en/listings/5",
    });
  });

  it("preserves query params in every locale's URL", () => {
    const urls = localizedUrls("/listings", { type: "auction" });
    expect(urls["zh-TW"]).toBe("https://xiangshuicn.cc/listings?type=auction");
    expect(urls["zh-CN"]).toBe("https://xiangshuicn.cc/zh-CN/listings?type=auction");
    expect(urls.en).toBe("https://xiangshuicn.cc/en/listings?type=auction");
  });

  it("handles the homepage path", () => {
    const urls = localizedUrls("/");
    expect(urls["zh-TW"]).toBe("https://xiangshuicn.cc/");
    expect(urls["zh-CN"]).toBe("https://xiangshuicn.cc/zh-CN");
    expect(urls.en).toBe("https://xiangshuicn.cc/en");
  });
});

describe("hreflangAlternates", () => {
  it("includes every locale plus an x-default pointing at the default locale's URL", () => {
    const alternates = hreflangAlternates("/contact");
    expect(alternates["zh-TW"]).toBe("https://xiangshuicn.cc/contact");
    expect(alternates["zh-CN"]).toBe("https://xiangshuicn.cc/zh-CN/contact");
    expect(alternates.en).toBe("https://xiangshuicn.cc/en/contact");
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
    ).toBe("https://xiangshuicn.cc/listings");
  });

  it("keeps the `type` param since it changes the listing set shown", () => {
    expect(canonicalListingsUrl("zh-TW", { type: "auction", sort: "price_asc" })).toBe(
      "https://xiangshuicn.cc/listings?type=auction",
    );
  });

  it("ignores an unrecognized type value", () => {
    expect(canonicalListingsUrl("zh-TW", { type: "not-a-real-type" })).toBe("https://xiangshuicn.cc/listings");
  });

  it("builds locale-prefixed canonical URLs for non-default locales", () => {
    expect(canonicalListingsUrl("en", { type: "fixed_price" })).toBe(
      "https://xiangshuicn.cc/en/listings?type=fixed_price",
    );
  });

  it("takes the first value when a param is passed as an array", () => {
    expect(canonicalListingsUrl("zh-TW", { type: ["auction", "fixed_price"] })).toBe(
      "https://xiangshuicn.cc/listings?type=auction",
    );
  });
});

describe("buildListingProductJsonLd", () => {
  const baseListing: ListingJsonLdInput = {
    id: 42,
    title: "冠軍血統種鴿",
    description: "<p>優秀血統，體況良好。</p>",
    listing_type: "auction",
    status: "open",
    price: null,
    current_price: 5000,
    stock_remaining: null,
    ends_at: new Date("2026-12-31T12:00:00Z"),
    photos: ["a.jpg", "b.jpg"],
  };

  it("builds a schema.org Product with an Offer for an open auction", () => {
    const jsonLd = buildListingProductJsonLd(baseListing, "/listings/42");
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Product");
    expect(jsonLd.name).toBe("冠軍血統種鴿");
    expect(jsonLd.description).toBe("優秀血統，體況良好。");
    expect(jsonLd.image).toEqual([
      "https://xiangshuicn.cc/uploads/listings/42/a.jpg",
      "https://xiangshuicn.cc/uploads/listings/42/b.jpg",
    ]);
    expect(jsonLd.url).toBe("https://xiangshuicn.cc/listings/42");

    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.priceCurrency).toBe("TWD");
    expect(offers.price).toBe(5000);
    expect(offers.availability).toBe("https://schema.org/InStock");
    expect(offers.priceValidUntil).toBe("2026-12-31");
  });

  it("falls back to the placeholder image when the listing has no photos", () => {
    const jsonLd = buildListingProductJsonLd({ ...baseListing, photos: [] }, "/listings/42");
    expect(jsonLd.image).toEqual(["https://xiangshuicn.cc/images/logo.png"]);
  });

  it("uses `price` (not current_price) for a fixed_price listing", () => {
    const jsonLd = buildListingProductJsonLd(
      { ...baseListing, listing_type: "fixed_price", price: 1200, current_price: 1200, stock_remaining: 5 },
      "/listings/42",
    );
    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers.price).toBe(1200);
    expect(offers.availability).toBe("https://schema.org/InStock");
  });

  it("marks a sold-out fixed_price listing OutOfStock even though status is still 'open'", () => {
    const jsonLd = buildListingProductJsonLd(
      { ...baseListing, listing_type: "fixed_price", price: 1200, stock_remaining: 0 },
      "/listings/42",
    );
    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("marks a scheduled (not-yet-open) listing PreOrder", () => {
    const jsonLd = buildListingProductJsonLd({ ...baseListing, status: "scheduled" }, "/listings/42");
    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/PreOrder");
  });

  it("marks a closed listing OutOfStock", () => {
    const jsonLd = buildListingProductJsonLd({ ...baseListing, status: "closed" }, "/listings/42");
    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("omits priceValidUntil for a fixed_price listing (no ends_at)", () => {
    const jsonLd = buildListingProductJsonLd(
      { ...baseListing, listing_type: "fixed_price", price: 1200, ends_at: null },
      "/listings/42",
    );
    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers).not.toHaveProperty("priceValidUntil");
  });

  it("includes merchant listing fields (itemCondition, seller, returnPolicy, shippingDetails)", () => {
    const jsonLd = buildListingProductJsonLd(baseListing, "/listings/42");
    const offers = jsonLd.offers as Record<string, unknown>;
    expect(offers.itemCondition).toBe("https://schema.org/NewCondition");
    expect(offers.seller).toEqual({
      "@type": "Organization",
      name: "翔水賽鴿網",
      url: "https://xiangshuicn.cc",
    });
    expect(offers.hasMerchantReturnPolicy).toBeDefined();
    expect(offers.shippingDetails).toBeDefined();
  });
});

describe("buildWebSiteJsonLd", () => {
  it("builds WebSite schema with Sitelinks searchbox action", () => {
    const jsonLd = buildWebSiteJsonLd();
    expect(jsonLd["@type"]).toBe("WebSite");
    expect(jsonLd.name).toBe("翔水賽鴿網");
    expect(jsonLd.potentialAction).toBeDefined();
  });
});

describe("buildOrganizationJsonLd", () => {
  it("builds Organization schema with logo and contactPoint", () => {
    const jsonLd = buildOrganizationJsonLd();
    expect(jsonLd["@type"]).toBe("Organization");
    expect(jsonLd.name).toBe("翔水賽鴿網");
    expect(jsonLd.logo).toBe("https://xiangshuicn.cc/images/logo.png");
    expect(jsonLd.contactPoint).toBeDefined();
  });
});

describe("buildBreadcrumbListJsonLd", () => {
  it("builds BreadcrumbList with correct 1-based positions and absolute URLs", () => {
    const jsonLd = buildBreadcrumbListJsonLd([
      { name: "首頁", pathname: "/" },
      { name: "拍賣競標", pathname: "/listings" },
      { name: "冠軍鴿", pathname: "/listings/10" },
    ]);
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    const items = jsonLd.itemListElement as Array<{ position: number; name: string; item: string }>;
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "首頁",
      item: "https://xiangshuicn.cc/",
    });
    expect(items[2]).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "冠軍鴿",
      item: "https://xiangshuicn.cc/listings/10",
    });
  });
});

describe("buildFaqPageJsonLd", () => {
  it("builds FAQPage schema from question and answer pairs", () => {
    const jsonLd = buildFaqPageJsonLd([
      { question: "如何競標？", answer: "註冊登入後即可出價。" },
    ]);
    expect(jsonLd["@type"]).toBe("FAQPage");
    const entities = jsonLd.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
    expect(entities[0].name).toBe("如何競標？");
    expect(entities[0].acceptedAnswer.text).toBe("註冊登入後即可出價。");
  });
});

describe("buildNewsArticleJsonLd", () => {
  it("builds NewsArticle schema with headline, publisher, and image", () => {
    const jsonLd = buildNewsArticleJsonLd({
      title: "春季拍賣會公告",
      description: "2026年春季拍賣會正式啟動",
      pathname: "/news/1",
      datePublished: "2026-03-01T00:00:00.000Z",
    });
    expect(jsonLd["@type"]).toBe("NewsArticle");
    expect(jsonLd.headline).toBe("春季拍賣會公告");
    expect(jsonLd.url).toBe("https://xiangshuicn.cc/news/1");
  });
});

describe("buildLlmsFullTxt", () => {
  const text = buildLlmsFullTxt();

  it("contains platform overview, auction rules, and machine-readable endpoints", () => {
    expect(text).toContain("Xiangshui Racing Pigeon Network（翔水賽鴿網）- 完整平台架構與競標指引");
    expect(text).toContain("Auto-Bidding");
    expect(text).toContain("https://xiangshuicn.cc/llms-full.txt");
  });
});

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt();

  it("starts with an H1 title", () => {
    expect(text.startsWith("# Xiangshui Racing Pigeon Network")).toBe(true);
  });

  it("links to the sitemap and robots.txt", () => {
    expect(text).toContain("https://xiangshuicn.cc/sitemap.xml");
    expect(text).toContain("https://xiangshuicn.cc/robots.txt");
  });

  it("links to every key public page", () => {
    expect(text).toContain("https://xiangshuicn.cc/");
    expect(text).toContain("https://xiangshuicn.cc/listings");
    expect(text).toContain("https://xiangshuicn.cc/contact");
    expect(text).toContain("https://xiangshuicn.cc/news");
    expect(text).toContain("https://xiangshuicn.cc/pigeon-showcase");
    expect(text).toContain("https://xiangshuicn.cc/featured-lofts");
    expect(text).toContain("https://xiangshuicn.cc/faq");
  });

  it("flags the admin backend and API routes as out of bounds", () => {
    expect(text).toContain("/z04urru6");
    expect(text).toContain("/api/*");
  });
});

describe("canonicalUrl", () => {
  it("builds a plain absolute canonical URL for the default locale", () => {
    expect(canonicalUrl("zh-TW", "/contact")).toBe("https://xiangshuicn.cc/contact");
  });

  it("builds a locale-prefixed canonical URL for a non-default locale", () => {
    expect(canonicalUrl("en", "/contact")).toBe("https://xiangshuicn.cc/en/contact");
  });
});
