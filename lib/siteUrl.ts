// Canonical source of truth for this site's public origin (issue #107) —
// every URL built for SEO purposes (sitemap.xml, canonical/hreflang <link>
// tags, Open Graph og:url, JSON-LD, llms.txt) should read from this one
// place instead of each hardcoding "https://bid.j172.tw" separately.
// NEXT_PUBLIC_SITE_URL lets a staging/preview deployment override it (the
// "NEXT_PUBLIC_" prefix isn't load-bearing here — nothing below ever needs
// this in client bundles today — it just keeps the name consistent with the
// convention people expect for a site-origin env var); production falls
// back to the real domain, same layered-default shape as lib/webauthn.ts's
// resolveWebauthnRp. Parametrized (not read from process.env directly at
// the call site) so this stays directly unit-testable — see siteUrl.test.ts.
export function resolveSiteUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  // Strip any trailing slash so callers can always safely do
  // `${SITE_URL}${pathname}` (pathname already starts with "/") without
  // risking a doubled slash.
  if (configured) return configured.replace(/\/+$/, "");
  return "https://bid.j172.tw";
}

export const SITE_URL = resolveSiteUrl();
