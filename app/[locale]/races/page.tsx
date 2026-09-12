import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  DEFAULT_RACE_PAGE_SIZE,
  RACE_PAGE_SIZES,
  isRacePageSize,
  isRaceStatus,
  listRaces,
  type RaceStatus,
} from "@/lib/races";
import { raceImageUrl } from "@/lib/uploads";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import { buildQuery, firstParam, type SearchParams } from "@/lib/searchParams";
import { Link } from "@/i18n/navigation";
import RaceCard, { type RaceCardItem } from "../components/RaceCard";
import PaginationFooter from "../components/PaginationFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "races" });
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      canonical: canonicalUrl(locale, "/races"),
      languages: hreflangAlternates("/races"),
    },
  };
}

const QUERY_KEYS = ["status", "pageSize", "page"] as const;

// Public /races list page (issue #241) — mirrors app/[locale]/news/page.tsx's
// structure (metadata, pagination, page-size picker) with a status-tag
// filter in place of news' title search box. Races from both independent
// sources (loing-ma.com/herbots.be) are listed together, sorted by
// race_date (see lib/races.ts's listRaces), each tagged with its own
// source/status badge.
export default async function RacesListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const t = await getTranslations("races");

  const statusRaw = firstParam(params.status);
  const status = statusRaw && isRaceStatus(statusRaw) ? statusRaw : undefined;
  const pageSizeRaw = Number(firstParam(params.pageSize));
  const pageSize = isRacePageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_RACE_PAGE_SIZE;
  const page = Math.max(1, Number(firstParam(params.page) ?? "1") || 1);

  const { items, total } = await listRaces({ status, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const statusLabel = (value: RaceStatus) =>
    ({ current: t("statusCurrent"), future: t("statusFuture"), finished: t("statusFinished") })[value];

  const cardItems: RaceCardItem[] = items.map((item) => ({
    id: item.id,
    source: item.source,
    status: item.status,
    title: item.title,
    originalTitle: item.originalTitle,
    content: item.content,
    originalContent: item.originalContent,
    raceDateLabel: item.raceDate ? t("raceDateLabel", { date: item.raceDate.toLocaleDateString() }) : null,
    imageUrl: item.imageFileName ? raceImageUrl(item.imageFileName) : null,
    sourceUrl: item.sourceUrl,
  }));

  const tabs: { value: RaceStatus | undefined; label: string }[] = [
    { value: undefined, label: t("filterAll") },
    { value: "current", label: t("filterCurrent") },
    { value: "future", label: t("filterFuture") },
    { value: "finished", label: t("filterFinished") },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
      <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.value ?? "all"}
            href={`/races?${buildQuery(params, QUERY_KEYS, { status: tab.value ?? "", page: "1" })}`}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              status === tab.value
                ? "bg-interactive-primary text-white"
                : "border border-border bg-white text-ink-light hover:border-interactive-primary/50"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {cardItems.length === 0 ? (
        <p className="mt-10 text-ink-light">{t("noItems")}</p>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {cardItems.map((item) => (
            <RaceCard
              key={item.id}
              item={item}
              labels={{
                sourceLabel: item.source === "loing_ma" ? t("sourceLoingMa") : t("sourceHerbots"),
                statusLabel: statusLabel(item.status),
                originalHeading: t("originalHeading"),
                sourceLinkLabel: t("sourceLinkLabel"),
              }}
            />
          ))}
        </div>
      )}

      <PaginationFooter
        pageSizes={RACE_PAGE_SIZES}
        pageSize={pageSize}
        page={page}
        totalPages={totalPages}
        pageSizeHref={(size) => `/races?${buildQuery(params, QUERY_KEYS, { pageSize: String(size), page: "1" })}`}
        pageHref={(target) => `/races?${buildQuery(params, QUERY_KEYS, { page: String(target) })}`}
        labels={{
          pageSizeLabel: t("pageSizeLabel"),
          prevPage: t("prevPage"),
          nextPage: t("nextPage"),
          pageInfo: t("pageInfo", { page, totalPages, total }),
        }}
      />
    </main>
  );
}
