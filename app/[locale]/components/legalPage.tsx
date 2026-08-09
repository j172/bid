import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import LegalPageShell from "./LegalPageShell";
import LegalSections, { type LegalSection } from "./LegalSections";

// The four legal pages (privacy / refund / terms / gdpr) were byte-identical
// templates differing only in their translation namespace and their
// pathname (issue #139 item 5).
//
// Collapsed into these two helpers rather than a `legal/[doc]` dynamic
// route: the four URLs are already public, linked from the footer and the
// cookie banner, and each is its own canonical/hreflang target, so keeping
// four real route files is both the smaller change and the one that leaves
// routing behaviour untouched. What each page file now carries is only what
// actually differs between them.

/** Metadata for one legal page — title/description from the namespace, canonical + hreflang from the pathname. */
export async function legalPageMetadata(namespace: string, pathname: string, locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace });
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: {
      canonical: canonicalUrl(locale, pathname),
      languages: hreflangAlternates(pathname),
    },
  };
}

/** Body of one legal page: the shared shell plus the namespace's `sections` array. */
export default async function LegalPage({ namespace }: { namespace: string }) {
  const t = await getTranslations(namespace);
  const sections = t.raw("sections") as LegalSection[];

  return (
    <LegalPageShell title={t("title")} intro={t("intro")} lastUpdated={t("lastUpdated")} notice={t("notice")}>
      <LegalSections sections={sections} />
    </LegalPageShell>
  );
}
