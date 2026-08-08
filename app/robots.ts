import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Second line of defense alongside app/z04urru6/layout.tsx's `robots: {
// index: false, follow: false }` metadata (see issue #106) — this keeps
// well-behaved crawlers from indexing the admin backend or API routes even
// before they'd notice the per-page noindex meta tag. `sitemap`/`host` now
// point at the dynamic sitemap (app/sitemap.ts) and canonical site URL
// (lib/siteUrl.ts) added in issue #107.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/z04urru6", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
