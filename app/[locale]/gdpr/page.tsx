import type { Metadata } from "next";
import LegalPage, { legalPageMetadata } from "../components/legalPage";

const NAMESPACE = "gdprPage";
const PATHNAME = "/gdpr";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return legalPageMetadata(NAMESPACE, PATHNAME, locale);
}

// The page the cookie banner links to (see components/CookieConsentBanner.tsx)
// — its "Cookie 現況" section is the canonical statement that this site only
// sets the login session cookie and no tracking/analytics ones.
export default async function GdprPage() {
  return <LegalPage namespace={NAMESPACE} />;
}
