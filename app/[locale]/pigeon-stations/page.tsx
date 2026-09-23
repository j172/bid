import type { Metadata } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { getTranslations } from "next-intl/server";
import { listPigeonStations } from "@/lib/pigeonStations";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import PigeonStationsExplorer from "./PigeonStationsExplorer";

// Issue #346: 取鴿站地圖目錄 — per the comment below, this was one-time
// seeded by an import script and is only maintained afterward through the
// admin CRUD, so it moves on a days/weeks cadence at most. A 1-hour ISR
// window is plenty fresh for reference/contact data like this.
export const revalidate = 3600;

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
  // Issue #346 follow-up — same NEXT_PHASE build guard as the homepage and
  // app/sitemap.ts (#347): CI's `next build` has no DB access, and
  // `revalidate` above makes Next eagerly prerender this route per locale
  // at build time. ISR regenerates the real directory on first real request.
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
    return <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6" />;
  }

  const t = await getTranslations("pigeonStations");
  const stations = await listPigeonStations();
  const sourceUrl = stations.find((station) => station.sourceUrl)?.sourceUrl;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
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
