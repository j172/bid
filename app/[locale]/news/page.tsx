import { getTranslations } from "next-intl/server";
import { DEFAULT_NEWS_PAGE_SIZE, NEWS_PAGE_SIZES, isNewsPageSize, listNews } from "@/lib/news";
import { excerptHtml } from "@/lib/htmlText";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

const LIST_EXCERPT_LENGTH = 100;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(params: SearchParams, overrides: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const key of ["search", "pageSize", "page"]) {
    const value = key in overrides ? overrides[key] : first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

// Public "最新訊息" list (issue #56) — card grid + pagination (30/50/100) +
// title fuzzy search, same layout shape as
// app/[locale]/pigeon-showcase/page.tsx's category list page.
export default async function NewsListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const t = await getTranslations("news");

  const search = first(params.search) ?? "";
  const pageSizeRaw = Number(first(params.pageSize));
  const pageSize = isNewsPageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_NEWS_PAGE_SIZE;
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

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

      {items.length === 0 ? (
        <p className="mt-10 text-ink-light">{t("noItems")}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/news/${item.id}`}
              className="group flex flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-xs font-semibold text-ink-light">{item.createdAt.toLocaleDateString()}</p>
              <h2 className="mt-1 truncate text-lg font-bold text-ink">{item.title}</h2>
              <p className="mt-3 line-clamp-3 text-sm text-ink-light">{excerptHtml(item.content, LIST_EXCERPT_LENGTH)}</p>
              <span className="mt-4 text-xs font-bold text-interactive-primary group-hover:underline">{t("viewDetails")}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm">
        <div className="flex items-center gap-2 text-ink-light">
          <span>{t("pageSizeLabel")}</span>
          {NEWS_PAGE_SIZES.map((size) => (
            <Link
              key={size}
              href={`/news?${buildQuery(params, { pageSize: String(size), page: "1" })}`}
              className={size === pageSize ? "font-bold text-interactive-primary underline" : "hover:text-interactive-primary"}
            >
              {size}
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            {page > 1 && (
              <Link href={`/news?${buildQuery(params, { page: String(page - 1) })}`} className="text-interactive-primary hover:underline">
                {t("prevPage")}
              </Link>
            )}
            <span className="text-ink-light">{t("pageInfo", { page, totalPages, total })}</span>
            {page < totalPages && (
              <Link href={`/news?${buildQuery(params, { page: String(page + 1) })}`} className="text-interactive-primary hover:underline">
                {t("nextPage")}
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
