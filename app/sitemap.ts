import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { listOpenListings } from "@/lib/listings";
import { hreflangAlternates, localizedUrls } from "@/lib/seo";

// Dynamic sitemap.xml (issue #107) — DB-backed (open listings change all the
// time), so this must never be statically frozen at build time. Matches this
// codebase's existing "force-dynamic" convention for every other DB-backed
// route (see app/z04urru6/**/page.tsx).
export const dynamic = "force-dynamic";

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
    ...localeEntries("/news", { changeFrequency: "daily", priority: 0.5 }),
    ...localeEntries("/pigeon-showcase", { changeFrequency: "weekly", priority: 0.4 }),
  ];

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

  return entries;
}
