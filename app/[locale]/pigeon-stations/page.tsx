import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { listPigeonStations } from "@/lib/pigeonStations";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import PigeonStationsExplorer from "./PigeonStationsExplorer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pigeonStations" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: canonicalUrl(locale, "/pigeon-stations"),
      languages: hreflangAlternates("/pigeon-stations"),
    },
  };
}

// Public "取鴿站地圖目錄" (issue #242 / Epic #239): a Leaflet + OpenStreetMap
// map plus a name/phone/address list for every row in `pigeon_stations`,
// seeded once by scripts/import-pigeon-stations.mjs and maintained
// thereafter through the admin CRUD at app/z04urru6/pigeon-stations.
export default async function PigeonStationsPage() {
  const t = await getTranslations("pigeonStations");
  const stations = await listPigeonStations();
  const sourceUrl = stations.find((station) => station.sourceUrl)?.sourceUrl;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
      <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>

      <PigeonStationsExplorer
        stations={stations.map((station) => ({
          id: station.id,
          name: station.name,
          phone: station.phone,
          address: station.address,
          lat: station.lat,
          lng: station.lng,
        }))}
      />

      {sourceUrl && (
        <p className="mt-6 text-xs text-ink-light">
          {t("sourceNote")}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-interactive-primary"
          >
            {sourceUrl}
          </a>
        </p>
      )}
    </main>
  );
}
