import { getTranslations } from "next-intl/server";
import {
  DEFAULT_FEATURED_LOFT_POST_PAGE_SIZE,
  FEATURED_LOFT_POST_PAGE_SIZES,
  isFeaturedLoftPostPageSize,
  listFeaturedLoftPosts,
} from "@/lib/featuredLoftPosts";
import { featuredLoftPostImageUrl } from "@/lib/uploads";
import { excerptHtml } from "@/lib/htmlText";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { buildQuery, firstParam, type SearchParams } from "@/lib/searchParams";
import ContentCardGrid from "../components/ContentCardGrid";
import PaginationFooter from "../components/PaginationFooter";

export const dynamic = "force-dynamic";

const LIST_EXCERPT_LENGTH = 100;
const QUERY_KEYS = ["search", "pageSize", "page"] as const;

// Public "名家專區" list (issue #176) — modeled directly on
// app/[locale]/news/page.tsx: card grid + pagination (30/50/100) + title
// fuzzy search, sharing its grid/pagination footer with news and
// pigeon-showcase (issue #139 item 8). Replaces issue #168's static card
// grid, which had no list/detail page of its own and linked straight to
// /listings?loft=<id>.
export default async function FeaturedLoftsListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const t = await getTranslations("featuredLofts");

  const search = firstParam(params.search) ?? "";
  const pageSizeRaw = Number(firstParam(params.pageSize));
  const pageSize = isFeaturedLoftPostPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_FEATURED_LOFT_POST_PAGE_SIZE;
  const page = Math.max(1, Number(firstParam(params.page) ?? "1") || 1);

  const { items, total } = await listFeaturedLoftPosts({ search, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black text-ink">{t("title")}</h1>
      <p className="mt-2 text-sm text-ink-light">{t("subtitle")}</p>

      <form method="GET" className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <input type="hidden" name="pageSize" value={pageSize} />
        <label className="flex flex-col gap-1 text-xs text-ink-light">
          {t("searchLabel")}
          <input
            name="search"
            defaultValue={search}
            placeholder={t("searchPlaceholder")}
            className="rounded-md border border-border px-3 py-1.5 text-sm focus:border-interactive-primary focus:outline-none"
          />
        </label>
        <button type="submit" className="rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active">
          {t("searchSubmit")}
        </button>
      </form>

      <ContentCardGrid
        items={items.map((item) => ({
          id: item.id,
          href: `/featured-lofts/${item.id}`,
          imageUrl: item.imageFileName ? featuredLoftPostImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC,
          title: item.title,
          dateLabel: item.createdAt.toLocaleDateString(),
          excerpt: excerptHtml(item.content, LIST_EXCERPT_LENGTH),
        }))}
        emptyLabel={t("noItems")}
        viewDetailsLabel={t("viewDetails")}
      />

      <PaginationFooter
        pageSizes={FEATURED_LOFT_POST_PAGE_SIZES}
        pageSize={pageSize}
        page={page}
        totalPages={totalPages}
        pageSizeHref={(size) => `/featured-lofts?${buildQuery(params, QUERY_KEYS, { pageSize: String(size), page: "1" })}`}
        pageHref={(target) => `/featured-lofts?${buildQuery(params, QUERY_KEYS, { page: String(target) })}`}
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
