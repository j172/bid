import { permanentRedirect } from "@/i18n/navigation";

// The auction terms page (issue #303) was merged into /terms (issue #313):
// the content now lives in termsPage's sections, so this route only exists
// to send existing links/search-engine indexes to the merged page instead
// of 404ing. permanentRedirect() is locale-aware (createNavigation), so
// /zh-TW/auction-terms -> /zh-TW/terms, /auction-terms (default locale,
// unprefixed) -> /terms, etc., and issues a 308 permanent redirect.
export default async function AuctionTermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect({ href: "/terms", locale });
}
