import type { PigeonShowcaseCategory } from "./pigeonShowcase";

export type LoftActiveTab = "listings" | "showcase";
export type ListingStatusScope = "open" | "closed" | "all";

export interface ShowcaseCategoryCounts {
  all: number;
  award: number;
  imported: number;
  representative: number;
}

/**
 * Resolves the statusScope for listings query.
 * For partner loft storefronts (loftId is present), defaults to "all" (both active and ended)
 * to avoid false-empty storefronts when currently open listings have ended (Issue #200).
 * For general /listings without loft filter, defaults to "open".
 */
export function resolveLoftStatusScope(
  loftId: number | undefined,
  rawStatus: string | undefined,
): ListingStatusScope {
  if (rawStatus === "closed") return "closed";
  if (rawStatus === "all") return "all";
  if (rawStatus === "open") return "open";
  return loftId !== undefined ? "all" : "open";
}

/**
 * Resolves the top-level tab for the loft storefront ("listings" or "showcase").
 */
export function resolveLoftActiveTab(rawTab: string | undefined): LoftActiveTab {
  return rawTab === "showcase" ? "showcase" : "listings";
}

/**
 * Counts pigeon showcase items by category for a loft.
 */
export function countShowcaseByCategory(
  items: readonly { category: PigeonShowcaseCategory }[],
): ShowcaseCategoryCounts {
  let award = 0;
  let imported = 0;
  let representative = 0;

  for (const item of items) {
    if (item.category === "award") award += 1;
    else if (item.category === "imported") imported += 1;
    else if (item.category === "representative") representative += 1;
  }

  return {
    all: items.length,
    award,
    imported,
    representative,
  };
}

/**
 * Builds the URL pointing to a partner loft's storefront, optionally targeting
 * the showcase tab or a specific showcase category.
 */
export function buildLoftShowcaseUrl(
  loftId: number,
  options?: {
    tab?: LoftActiveTab;
    showcaseCategory?: PigeonShowcaseCategory;
    status?: ListingStatusScope;
  },
): string {
  const sp = new URLSearchParams();
  sp.set("loft", String(loftId));
  if (options?.tab && options.tab !== "listings") {
    sp.set("tab", options.tab);
  }
  if (options?.showcaseCategory) {
    sp.set("showcaseCategory", options.showcaseCategory);
  }
  if (options?.status && options.status !== "all") {
    sp.set("status", options.status);
  }
  const query = sp.toString();
  return query ? `/listings?${query}` : "/listings";
}
