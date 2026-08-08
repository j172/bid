import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import LegalPageShell from "../components/LegalPageShell";
import LegalSections, { type LegalSection } from "../components/LegalSections";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gdprPage" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: {
      canonical: canonicalUrl(locale, "/gdpr"),
      languages: hreflangAlternates("/gdpr"),
    },
  };
}

// The page the cookie banner links to (see components/CookieConsentBanner.tsx)
// — its "Cookie 現況" section is the canonical statement that this site only
// sets the login session cookie and no tracking/analytics ones.
export default async function GdprPage() {
  const t = await getTranslations("gdprPage");
  const sections = t.raw("sections") as LegalSection[];

  return (
    <LegalPageShell title={t("title")} intro={t("intro")} lastUpdated={t("lastUpdated")} notice={t("notice")}>
      <LegalSections sections={sections} />
    </LegalPageShell>
  );
}
