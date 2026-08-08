import type { MetadataRoute } from "next";

// Second line of defense alongside app/z04urru6/layout.tsx's `robots: {
// index: false, follow: false }` metadata (see issue #106) — this keeps
// well-behaved crawlers from indexing the admin backend or API routes even
// before they'd notice the per-page noindex meta tag. No `sitemap`/`host`
// field here: there's no NEXT_PUBLIC_SITE_URL-style env var for the site's
// canonical origin yet (tracked separately in issue #107).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/z04urru6", "/api"],
    },
  };
}
