import { getTranslations } from "next-intl/server";
import {
  DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE,
  PIGEON_SHOWCASE_PAGE_SIZES,
  isPigeonShowcasePageSize,
  listPigeonShowcase,
  type PigeonShowcaseCategory,
} from "@/lib/pigeonShowcase";
import { isPigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";
import { pigeonShowcaseImageUrl } from "@/lib/uploads";
import { excerptHtml } from "@/lib/htmlText";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { buildQuery, firstParam, type SearchParams } from "@/lib/searchParams";
import { Link } from "@/i18n/navigation";
import ContentCardGrid from "../components/ContentCardGrid";
import PaginationFooter from "../components/PaginationFooter";

export const dynamic = "force-dynamic";

const LIST_EXCERPT_LENGTH = 100;
const QUERY_KEYS = ["category", "pageSize", "page", "loftId"] as const;

// Shares its card grid and pagination footer with app/[locale]/news/page.tsx
// (issue #139 item 8); the category tabs are this page's own.
export default async function PigeonShowcaseListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const t = await getTranslations("pigeonShowcase");

  // No valid ?category= falls back to 'award' — issue #54's homepage cards
  // and admin list always link here with an explicit category, so this only
  // matters for a hand-typed/bare /pigeon-showcase URL.
  const categoryRaw = firstParam(params.category) ?? "";
  const category: PigeonShowcaseCategory = isPigeonShowcaseCategory(categoryRaw) ? categoryRaw : "award";
  const pageSizeRaw = Number(firstParam(params.pageSize));
  const pageSize = isPigeonShowcasePageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE;
  const page = Math.max(1, Number(firstParam(params.page) ?? "1") || 1);
  // ?loftId= filters to one loft's items (issue #155 item 1, linked from the
  // detail page's "鴿舍：OOO" line). Anything non-numeric/non-positive is
  // treated as absent rather than sent to the DB.
  const loftIdRaw = Number(firstParam(params.loftId));
  const loftId = Number.isInteger(loftIdRaw) && loftIdRaw > 0 ? loftIdRaw : undefined;

  const { items, total } = await listPigeonShowcase({ category, page, pageSize, loftId });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const categoryTitle = category === "award" ? t("awardTitle") : t("importedTitle");
  // The loft title comes from the filtered results themselves (they're
  // already JOINed with homepage_sections in lib/pigeonShowcase.ts) rather
  // than a second query. If the filter matched nothing there's no title to
  // read, so fall back to the plain category title instead of failing.
  const loftTitle = items[0]?.loftTitle;
  const pageTitle =
    loftId !== undefined && loftTitle
      ? t(category === "award" ? "loftAwardTitle" : "loftImportedTitle", { loft: loftTitle })
      : categoryTitle;

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      active ? "bg-header text-white" : "bg-surface-muted text-ink-light hover:bg-surface"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black text-ink">{pageTitle}</h1>
      <p className="mt-2 text-sm text-ink-light">{t("listSubtitle")}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {/* Switching category tabs returns to that category's full list —
            clears loftId rather than carrying it along. */}
        <Link
          href={`/pigeon-showcase?${buildQuery(params, QUERY_KEYS, { category: "award", page: "1", loftId: "" })}`}
          className={tabClass(category === "award")}
        >
          {t("awardTitle")}
        </Link>
        <Link
          href={`/pigeon-showcase?${buildQuery(params, QUERY_KEYS, { category: "imported", page: "1", loftId: "" })}`}
          className={tabClass(category === "imported")}
        >
          {t("importedTitle")}
        </Link>
      </div>

      <ContentCardGrid
        items={items.map((item) => ({
          id: item.id,
          href: `/pigeon-showcase/${item.id}`,
          imageUrl: item.imageFileName ? pigeonShowcaseImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC,
          title: item.name,
          badgeLabel: item.loftTitle,
          excerpt: excerptHtml(item.description, LIST_EXCERPT_LENGTH),
        }))}
        emptyLabel={t("noItems")}
        viewDetailsLabel={t("viewDetails")}
      />

      <PaginationFooter
        pageSizes={PIGEON_SHOWCASE_PAGE_SIZES}
        pageSize={pageSize}
        page={page}
        totalPages={totalPages}
        pageSizeHref={(size) =>
          `/pigeon-showcase?${buildQuery(params, QUERY_KEYS, { pageSize: String(size), page: "1" })}`
        }
        pageHref={(target) => `/pigeon-showcase?${buildQuery(params, QUERY_KEYS, { page: String(target) })}`}
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
