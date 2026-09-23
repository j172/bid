import type { MetadataRoute } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { routing } from "@/i18n/routing";
import { listOpenListings } from "@/lib/listings";
import { listNewsForSitemap } from "@/lib/news";
import { listHomepageSections } from "@/lib/homepageSections";
import { hreflangAlternates, localizedUrls } from "@/lib/seo";

// ISR sitemap.xml (issue #347, revisiting issue #107's force-dynamic) —
// DB-backed (open listings/news change often), but this only needs to be
// fresh to within a few minutes, not per-request live: crawlers (Google and
// every other SEO tool/scanner hitting /sitemap.xml) don't need second-level
// accuracy, and force-dynamic meant every single hit ran 3 live DB queries
// with zero caching. 10 minutes balances index freshness against DB load.
export const revalidate = 600;

// Every locale's URL for one logical page, each carrying the full
// alternates.languages map so search engines get hreflang cross-references
// straight from the sitemap (Next.js's documented alternative to per-page
// <link rel="alternate"> tags — see generateMetadata's own hreflang wiring
// for pages that also need it there).
function localeEntries(
  pathname: string,
  options: {
    query?: Record<string, string>;
    lastModified?: Date;
    changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority?: number;
  } = {},
): MetadataRoute.Sitemap {
  const urls = localizedUrls(pathname, options.query);
  const languages = hreflangAlternates(pathname, options.query);
  return routing.locales.map((locale) => ({
    url: urls[locale],
    lastModified: options.lastModified,
    changeFrequency: options.changeFrequency,
    priority: options.priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    ...localeEntries("/", { changeFrequency: "daily", priority: 1 }),
    ...localeEntries("/listings", { changeFrequency: "hourly", priority: 0.9 }),
    ...localeEntries("/listings", { query: { type: "auction" }, changeFrequency: "hourly", priority: 0.8 }),
    ...localeEntries("/listings", { query: { type: "fixed_price" }, changeFrequency: "hourly", priority: 0.8 }),
    ...localeEntries("/contact", { changeFrequency: "yearly", priority: 0.3 }),
    // Static legal/help pages (issue #121) — same "rarely changes, low
    // priority" treatment as /contact.
    ...localeEntries("/privacy", { changeFrequency: "yearly", priority: 0.3 }),
    ...localeEntries("/refund", { changeFrequency: "yearly", priority: 0.3 }),
    ...localeEntries("/terms", { changeFrequency: "yearly", priority: 0.3 }),
    ...localeEntries("/faq", { changeFrequency: "yearly", priority: 0.3 }),
    ...localeEntries("/gdpr", { changeFrequency: "yearly", priority: 0.3 }),
    ...localeEntries("/news", { changeFrequency: "daily", priority: 0.5 }),
    ...localeEntries("/pigeon-showcase", { changeFrequency: "weekly", priority: 0.4 }),
  ];

  // Skip the DB-backed sections during `next build`: with revalidate set
  // (instead of force-dynamic), Next eagerly prerenders this route as part
  // of the production build (see the bundled Next docs — sitemap routes are
  // "cached by default unless it uses a Request-time API or dynamic config
  // option"). This repo's CI build step (.github/workflows/deploy-ftps.yml)
  // runs on a GitHub Actions runner with no access to the production DB, so
  // querying here unconditionally would make every build fail. Returning
  // just the static entries at build time is safe: ISR regenerates this
  // route with real DB data once it's actually served in production (within
  // `revalidate` seconds of deploy), which the build phase never does.
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    return entries;
  }

  // All currently-open/scheduled listings (every listing type, every partner
  // loft) — the actual product pages this whole feature exists to get
  // indexed. Closed/cancelled listings are deliberately excluded: they're no
  // longer purchasable, so indexing them would just send search traffic to
  // dead ends (contrast lib/listings.ts's admin views, which do need
  // closed listings for settlement bookkeeping).
  const listings = await listOpenListings();
  for (const listing of listings) {
    entries.push(
      ...localeEntries(`/listings/${listing.id}`, {
        lastModified: listing.created_at,
        changeFrequency: "hourly",
        priority: 0.7,
      }),
    );
  }

  // All published news announcements (issue #191) across every locale.
  const newsItems = await listNewsForSitemap();
  for (const post of newsItems) {
    entries.push(
      ...localeEntries(`/news/${post.id}`, {
        lastModified: post.updatedAt ?? post.createdAt,
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );
  }

  // All active 名家專區 article pages (issue #314) — same treatment as the
  // news detail pages above.
  const featuredLofts = await listHomepageSections("featured_loft", { activeOnly: true });
  for (const section of featuredLofts) {
    entries.push(
      ...localeEntries(`/featured-lofts/${section.id}`, {
        lastModified: section.updatedAt,
        changeFrequency: "weekly",
        priority: 0.5,
      }),
    );
  }

  return entries;
}
