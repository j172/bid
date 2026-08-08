import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import LegalPageShell from "../components/LegalPageShell";
import LegalSections, { type LegalSection } from "../components/LegalSections";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacyPage" });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: {
      canonical: canonicalUrl(locale, "/privacy"),
      languages: hreflangAlternates("/privacy"),
    },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacyPage");
  const sections = t.raw("sections") as LegalSection[];

  return (
    <LegalPageShell title={t("title")} intro={t("intro")} lastUpdated={t("lastUpdated")} notice={t("notice")}>
      <LegalSections sections={sections} />
    </LegalPageShell>
  );
}
