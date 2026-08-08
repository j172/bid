// Pure, framework-light SEO/GEO helpers (issue #107) shared by app/sitemap.ts
// and the various generateMetadata functions across the public site. Kept
// separate from those Next.js entry points (which need real request/params
// plumbing) so the actual string-building logic stays directly unit-testable
// — same split as this project's other lib/*.ts helpers (e.g. lib/currency.ts).
//
// Deliberately does NOT import next-intl's createNavigation/getPathname
// (i18n/navigation.ts) here: that module's react-client build pulls in
// "next/navigation", which vitest's plain Node test environment can't
// resolve (no request/RSC context to condition the export map on) — it's
// meant for use inside components. This file instead reimplements just the
// one piece of routing.ts's convention this project relies on ("as-needed"
// locale prefixing: the default locale, zh-TW, stays unprefixed; other
// locales get a /xx prefix — see i18n/routing.ts's own comment), so the
// logic stays plain and directly testable.
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/siteUrl";

/** Query params that survive canonicalization because they change the actual
 * content set shown (much like a real category page would), as opposed to
 * cosmetic/view-only params (sort, page, perf, q, min/maxPrice, withinHours,
 * loft) which all resolve to the same canonical listings page. */
export type ListingsCategoryFilter = "auction" | "fixed_price";

function isListingsCategoryFilter(value: unknown): value is ListingsCategoryFilter {
  return value === "auction" || value === "fixed_price";
}

// Collapses whitespace and truncates on a word boundary where possible,
// appending an ellipsis — used to build <meta description>/OG description
// text from free-form listing titles/descriptions, which can run arbitrarily
// long but should stay in the ~150-160 char range search engines display.
export function truncateForMetaDescription(text: string, maxLength = 160): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  const sliced = collapsed.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  // Only break on the last space if it doesn't throw away too much of the
  // budget (e.g. a single very long word) — otherwise just hard-truncate.
  const base = lastSpace > maxLength * 0.6 ? sliced.slice(0, lastSpace) : sliced;
  return `${base.trimEnd()}…`;
}

// Turns a site-relative pathname into an absolute URL under SITE_URL —
// every sitemap/canonical/hreflang/OG/JSON-LD URL funnels through this so
// there's exactly one place that joins the two.
export function absoluteUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

// Locale-prefixes `pathname` following this project's "as-needed" convention
// (see the file header comment and i18n/routing.ts): the default locale gets
// no prefix at all, every other locale gets a leading /xx. Mirrors what
// next-intl's own middleware/navigation would produce for this routing
// config, without needing to import its component-oriented navigation build.
function localizedPathname(pathname: string, locale: string): string {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (locale === routing.defaultLocale) return normalized;
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

function withQuery(pathname: string, query?: Record<string, string>): string {
  if (!query || Object.keys(query).length === 0) return pathname;
  const search = new URLSearchParams(query).toString();
  return `${pathname}?${search}`;
}

// Builds every routing locale's absolute URL for `pathname` (optionally with
// query params). Powers both app/sitemap.ts's per-locale entries and
// hreflangAlternates below.
export function localizedUrls(pathname: string, query?: Record<string, string>): Record<string, string> {
  const entries = routing.locales.map((locale) => {
    return [locale, absoluteUrl(withQuery(localizedPathname(pathname, locale), query))] as const;
  });
  return Object.fromEntries(entries);
}

// hreflang alternates map for generateMetadata's `alternates.languages` —
// every locale's URL, plus an "x-default" entry pointing at the routing
// default locale's version, per Google's guidance for a language-neutral
// fallback (https://developers.google.com/search/docs/specialty/international/localized-versions).
export function hreflangAlternates(pathname: string, query?: Record<string, string>): Record<string, string> {
  const urls = localizedUrls(pathname, query);
  return { ...urls, "x-default": urls[routing.defaultLocale] };
}

// The canonical URL for the public listings list/category page, given the
// current locale and raw searchParams — strips every query param except
// `type` (auction vs fixed_price genuinely changes the listing set shown,
// like a real category page would), so cosmetic/view-only params (sort,
// page, perf, q, minPrice/maxPrice, withinHours, loft) don't fracture one
// logical page into many distinct "canonical" URLs (issue #107 item 7).
export function canonicalListingsUrl(
  locale: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const rawType = Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type;
  const query = isListingsCategoryFilter(rawType) ? { type: rawType } : undefined;
  return absoluteUrl(withQuery(localizedPathname("/listings", locale), query));
}

// The canonical URL for any other page (no content-shaping query params to
// preserve) — just the locale-prefixed pathname, absolute.
export function canonicalUrl(locale: string, pathname: string): string {
  return absoluteUrl(localizedPathname(pathname, locale));
}
