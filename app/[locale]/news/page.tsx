import { getTranslations } from "next-intl/server";
import { DEFAULT_NEWS_PAGE_SIZE, NEWS_PAGE_SIZES, isNewsPageSize, listNews } from "@/lib/news";
import { newsImageUrl } from "@/lib/uploads";
import { excerptHtml } from "@/lib/htmlText";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { buildQuery, firstParam, type SearchParams } from "@/lib/searchParams";
import ContentCardGrid from "../components/ContentCardGrid";
import PaginationFooter from "../components/PaginationFooter";

export const dynamic = "force-dynamic";

const LIST_EXCERPT_LENGTH = 100;
const QUERY_KEYS = ["search", "pageSize", "page"] as const;

// Public "最新訊息" list (issue #56) — card grid + pagination (30/50/100) +
// title fuzzy search. Shares its grid and pagination footer with
// app/[locale]/pigeon-showcase/page.tsx (issue #139 item 8); the search form
// is this page's own, since that list filters by category tabs instead.
export default async function NewsListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const t = await getTranslations("news");

  const search = firstParam(params.search) ?? "";
  const pageSizeRaw = Number(firstParam(params.pageSize));
  const pageSize = isNewsPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_NEWS_PAGE_SIZE;
  const page = Math.max(1, Number(firstParam(params.page) ?? "1") || 1);

  const { items, total } = await listNews({ search, page, pageSize });
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
          href: `/news/${item.id}`,
          imageUrl: item.imageFileName ? newsImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC,
          title: item.title,
          dateLabel: item.createdAt.toLocaleDateString(),
          excerpt: excerptHtml(item.content, LIST_EXCERPT_LENGTH),
        }))}
        emptyLabel={t("noItems")}
        viewDetailsLabel={t("viewDetails")}
      />

      <PaginationFooter
        pageSizes={NEWS_PAGE_SIZES}
        pageSize={pageSize}
        page={page}
        totalPages={totalPages}
        pageSizeHref={(size) => `/news?${buildQuery(params, QUERY_KEYS, { pageSize: String(size), page: "1" })}`}
        pageHref={(target) => `/news?${buildQuery(params, QUERY_KEYS, { page: String(target) })}`}
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
