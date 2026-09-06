import { describe, expect, it } from "vitest";
import {
  buildLoftShowcaseUrl,
  countShowcaseByCategory,
  resolveLoftActiveTab,
  resolveLoftStatusScope,
} from "./loftStorefront";
import type { PigeonShowcaseCategory } from "./pigeonShowcase";

describe("resolveLoftStatusScope", () => {
  it("defaults to 'all' when a partner loft is specified without a rawStatus (Issue #200)", () => {
    // This ensures visiting /listings?loft=1 displays all historical and current listings
    // instead of showing a false-empty state when current auctions have ended.
    expect(resolveLoftStatusScope(1, undefined)).toBe("all");
    expect(resolveLoftStatusScope(42, "")).toBe("all");
  });

  it("defaults to 'open' when no loft is specified (general /listings page behavior)", () => {
    expect(resolveLoftStatusScope(undefined, undefined)).toBe("open");
    expect(resolveLoftStatusScope(undefined, "")).toBe("open");
  });

  it("respects explicit status query params regardless of loft selection", () => {
    expect(resolveLoftStatusScope(1, "open")).toBe("open");
    expect(resolveLoftStatusScope(1, "closed")).toBe("closed");
    expect(resolveLoftStatusScope(1, "all")).toBe("all");

    expect(resolveLoftStatusScope(undefined, "open")).toBe("open");
    expect(resolveLoftStatusScope(undefined, "closed")).toBe("closed");
    expect(resolveLoftStatusScope(undefined, "all")).toBe("all");
  });
});

describe("resolveLoftActiveTab", () => {
  it("returns 'showcase' when tab is 'showcase'", () => {
    expect(resolveLoftActiveTab("showcase")).toBe("showcase");
  });

  it("defaults to 'listings' for undefined, empty, or unknown values", () => {
    expect(resolveLoftActiveTab(undefined)).toBe("listings");
    expect(resolveLoftActiveTab("")).toBe("listings");
    expect(resolveLoftActiveTab("listings")).toBe("listings");
    expect(resolveLoftActiveTab("other")).toBe("listings");
  });
});

describe("countShowcaseByCategory", () => {
  it("computes category counts and total accurately", () => {
    const items: Array<{ category: PigeonShowcaseCategory }> = [
      { category: "award" },
      { category: "award" },
      { category: "imported" },
      { category: "representative" },
    ];

    expect(countShowcaseByCategory(items)).toEqual({
      all: 4,
      award: 2,
      imported: 1,
      representative: 1,
    });
  });

  it("returns zeros for empty items", () => {
    expect(countShowcaseByCategory([])).toEqual({
      all: 0,
      award: 0,
      imported: 0,
      representative: 0,
    });
  });
});

describe("buildLoftShowcaseUrl", () => {
  it("builds a basic loft storefront link", () => {
    expect(buildLoftShowcaseUrl(1)).toBe("/listings?loft=1");
  });

  it("builds a link targeting the showcase tab", () => {
    expect(buildLoftShowcaseUrl(1, { tab: "showcase" })).toBe("/listings?loft=1&tab=showcase");
  });

  it("includes showcaseCategory when specified", () => {
    expect(
      buildLoftShowcaseUrl(5, { tab: "showcase", showcaseCategory: "award" }),
    ).toBe("/listings?loft=5&tab=showcase&showcaseCategory=award");
  });

  it("omits tab param when tab is 'listings' (the default)", () => {
    expect(buildLoftShowcaseUrl(1, { tab: "listings" })).toBe("/listings?loft=1");
  });
});
