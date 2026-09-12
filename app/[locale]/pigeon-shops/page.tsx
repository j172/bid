import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import { listPigeonShops } from "@/lib/pigeonShops";
import PigeonShopsExplorer from "./PigeonShopsExplorer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pigeonShopsPage" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: canonicalUrl(locale, "/pigeon-shops"),
      languages: hreflangAlternates("/pigeon-shops"),
    },
  };
}

// Public 鴿店地圖目錄 (issue #243, part of Epic #239) — a flat directory of
// pigeon-shop contact info one-time-imported from nicepigeon.com by
// scripts/import-pigeon-shops.mjs (see db/init.sql's pigeon_shops table
// comment). Deliberately its own page, kept separate from the sibling
// 取鴿站 directory added by issue #242, even though both share the same
// Leaflet/OpenStreetMap map shape (see that issue's "不合併成同一個地圖
// 目錄頁" decision).
export default async function PigeonShopsPage() {
  const t = await getTranslations("pigeonShopsPage");
  const shops = await listPigeonShops();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
        <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>
      </div>

      <section className="mt-6">
        {shops.length === 0 ? (
          <p className="rounded-xl border border-border bg-white p-6 text-sm text-ink-light">{t("empty")}</p>
        ) : (
          <PigeonShopsExplorer
            shops={shops.map((shop) => ({
              id: shop.id,
              name: shop.name,
              phone: shop.phone,
              address: shop.address,
              lat: shop.lat,
              lng: shop.lng,
            }))}
            noPhoneLabel={t("noPhone")}
            noAddressLabel={t("noAddress")}
            noCoordinatesLabel={t("noCoordinates")}
          />
        )}
      </section>
    </main>
  );
}
