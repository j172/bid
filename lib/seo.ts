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
import sanitizeHtml from "sanitize-html";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/siteUrl";
import { listingPhotoUrl } from "@/lib/uploads";

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

// Strips a listing's stored description down to plain text — descriptions
// are rich-text HTML from the admin's TinyMCE editor (already
// XSS-sanitized on write, see lib/sanitizeDescriptionHtml.ts), but
// <meta description>/OG description/JSON-LD text all need plain text, not
// markup. Reuses the same sanitize-html library (no jsdom dependency, see
// that file's header comment) with an empty allow-list so every tag is
// stripped and only the text content survives.
export function stripHtmlToPlainText(html: string): string {
  // Insert a space between adjacent tags first (e.g. "</p><p>") so stripping
  // block-level boundaries below doesn't glue two paragraphs' text together
  // into one run-on word.
  const spaced = html.replace(/>\s*</g, "> <");
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
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

export type JsonLdAvailability =
  | "https://schema.org/InStock"
  | "https://schema.org/OutOfStock"
  | "https://schema.org/PreOrder";

// Only the lib/listings.ts Listing fields buildListingProductJsonLd actually
// needs — kept as its own narrow shape (rather than importing the full
// ListingWithPhotos type) so this stays a plain data-in/data-out function
// callers can pass a listing straight into.
export interface ListingJsonLdInput {
  id: number;
  title: string;
  description: string;
  listing_type: "auction" | "fixed_price";
  status: string;
  price: number | null;
  current_price: number;
  stock_remaining: number | null;
  ends_at: Date | null;
  photos: string[];
}

// schema.org Offer.availability for a listing — 'scheduled' listings are
// visible but not yet biddable/buyable (PreOrder), 'open' fixed_price
// listings that have sold through their stock are OutOfStock despite
// status still being 'open' (see lib/listings.ts's listOpenListings, which
// doesn't filter on stock), and anything else non-'open' (closed,
// cancelled) is OutOfStock — schema.org has no dedicated "auction ended"
// value, and OutOfStock communicates the same "can't actually buy this
// right now" fact to both search engines and GEO/AI crawlers.
function listingAvailability(
  listing: Pick<ListingJsonLdInput, "status" | "listing_type" | "stock_remaining">,
): JsonLdAvailability {
  if (listing.status === "scheduled") return "https://schema.org/PreOrder";
  if (listing.status !== "open") return "https://schema.org/OutOfStock";
  if (listing.listing_type === "fixed_price" && (listing.stock_remaining ?? 0) <= 0) {
    return "https://schema.org/OutOfStock";
  }
  return "https://schema.org/InStock";
}

// Builds schema.org Product/Offer JSON-LD for a listing detail page (issue
// #107 item 3) — lets Google show rich-result price/availability, and gives
// AI/GEO crawlers a structured, unambiguous read on what's for sale versus
// having to parse it out of the rendered page. `pathname` is this listing's
// site-relative detail-page path for the current locale (e.g.
// "/listings/42" or "/en/listings/42") — callers build it once and pass it
// in rather than this function reaching for locale/routing concerns itself.
export function buildListingProductJsonLd(listing: ListingJsonLdInput, pathname: string): Record<string, unknown> {
  const price = listing.listing_type === "fixed_price" ? (listing.price ?? listing.current_price) : listing.current_price;
  const images =
    listing.photos.length > 0
      ? listing.photos.map((fileName) => absoluteUrl(listingPhotoUrl(listing.id, fileName)))
      : [absoluteUrl("/images/hero-placeholder.png")];
  const url = absoluteUrl(pathname);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: truncateForMetaDescription(stripHtmlToPlainText(listing.description), 300),
    image: images,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "TWD",
      price,
      availability: listingAvailability(listing),
      // Only auction listings have a real deadline (fixed_price listings
      // sell indefinitely until stock runs out — see lib/listings.ts's
      // Listing.ends_at comment) — omitted entirely rather than emitted as
      // null, since JSON-LD consumers generally treat a present-but-null
      // field as "unknown" rather than "not applicable".
      ...(listing.ends_at ? { priceValidUntil: listing.ends_at.toISOString().slice(0, 10) } : {}),
    },
  };
}
