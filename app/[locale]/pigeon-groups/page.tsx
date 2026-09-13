import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import { listPigeonGroups } from "@/lib/pigeonGroups";
import PigeonGroupsExplorer from "./PigeonGroupsExplorer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pigeonGroupsPage" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: canonicalUrl(locale, "/pigeon-groups"),
      languages: hreflangAlternates("/pigeon-groups"),
    },
  };
}

// Public 鴿會查詢 (issue #260, part of Epic #239) — a flat directory of
// pigeon-association contact info one-time-imported from cb-pigeon.com by
// scripts/import-cb-pigeon-groups.mjs (see db/init.sql's pigeon_groups table
// comment). Deliberately its own page, kept separate from the sibling
// 鴿店地圖目錄/取鴿站 directories, even though all three share the same
// Leaflet/OpenStreetMap map shape (see issue #242's "不合併成同一個地圖
// 目錄頁" decision, reaffirmed for this ticket).
export default async function PigeonGroupsPage() {
  const t = await getTranslations("pigeonGroupsPage");
  const groups = await listPigeonGroups();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
        <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>
      </div>

      <section className="mt-6">
        {groups.length === 0 ? (
          <p className="rounded-xl border border-border bg-white p-6 text-sm text-ink-light">{t("empty")}</p>
        ) : (
          <PigeonGroupsExplorer
            groups={groups.map((group) => ({
              id: group.id,
              name: group.name,
              address: group.address,
              lat: group.lat,
              lng: group.lng,
              chairmanName: group.chairmanName,
              chairmanPhone: group.chairmanPhone,
              secretaryName: group.secretaryName,
              secretaryPhone: group.secretaryPhone,
              websiteUrl: group.websiteUrl,
              pigeonTrackingUrl: group.pigeonTrackingUrl,
            }))}
            noAddressLabel={t("noAddress")}
            noCoordinatesLabel={t("noCoordinates")}
          />
        )}
      </section>
    </main>
  );
}
