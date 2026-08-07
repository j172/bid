import { getTranslations } from "next-intl/server";
import {
  DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE,
  PIGEON_SHOWCASE_PAGE_SIZES,
  isPigeonShowcasePageSize,
  listPigeonShowcase,
  type PigeonShowcaseCategory,
} from "@/lib/pigeonShowcase";
import { isPigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";
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
  for (const key of ["category", "pageSize", "page"]) {
    const value = key in overrides ? overrides[key] : first(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export default async function PigeonShowcaseListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const t = await getTranslations("pigeonShowcase");

  // No valid ?category= falls back to 'award' — issue #54's homepage cards
  // and admin list always link here with an explicit category, so this only
  // matters for a hand-typed/bare /pigeon-showcase URL.
  const categoryRaw = first(params.category) ?? "";
  const category: PigeonShowcaseCategory = isPigeonShowcaseCategory(categoryRaw) ? categoryRaw : "award";
  const pageSizeRaw = Number(first(params.pageSize));
  const pageSize = isPigeonShowcasePageSize(pageSizeRaw) ? pageSizeRaw : DEFAULT_PIGEON_SHOWCASE_PAGE_SIZE;
  const page = Math.max(1, Number(first(params.page) ?? "1") || 1);

  const { items, total } = await listPigeonShowcase({ category, page, pageSize });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      active ? "bg-header text-white" : "bg-surface-muted text-ink-light hover:bg-surface"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-black text-ink">{category === "award" ? t("awardTitle") : t("importedTitle")}</h1>
      <p className="mt-2 text-sm text-ink-light">{t("listSubtitle")}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/pigeon-showcase?${buildQuery(params, { category: "award", page: "1" })}`} className={tabClass(category === "award")}>
          {t("awardTitle")}
        </Link>
        <Link href={`/pigeon-showcase?${buildQuery(params, { category: "imported", page: "1" })}`} className={tabClass(category === "imported")}>
          {t("importedTitle")}
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-ink-light">{t("noItems")}</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/pigeon-showcase/${item.id}`}
              className="group flex flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="truncate text-lg font-bold text-ink">{item.name}</h2>
              <p className="mt-1 inline-flex w-fit rounded-full bg-interactive-primary-subtle px-2 py-0.5 text-xs font-semibold text-interactive-primary">
                {item.loftTitle}
              </p>
              <p className="mt-3 line-clamp-3 text-sm text-ink-light">{excerptHtml(item.description, LIST_EXCERPT_LENGTH)}</p>
              <span className="mt-4 text-xs font-bold text-interactive-primary group-hover:underline">{t("viewDetails")}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm">
        <div className="flex items-center gap-2 text-ink-light">
          <span>{t("pageSizeLabel")}</span>
          {PIGEON_SHOWCASE_PAGE_SIZES.map((size) => (
            <Link
              key={size}
              href={`/pigeon-showcase?${buildQuery(params, { pageSize: String(size), page: "1" })}`}
              className={size === pageSize ? "font-bold text-interactive-primary underline" : "hover:text-interactive-primary"}
            >
              {size}
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            {page > 1 && (
              <Link href={`/pigeon-showcase?${buildQuery(params, { page: String(page - 1) })}`} className="text-interactive-primary hover:underline">
                {t("prevPage")}
              </Link>
            )}
            <span className="text-ink-light">{t("pageInfo", { page, totalPages, total })}</span>
            {page < totalPages && (
              <Link href={`/pigeon-showcase?${buildQuery(params, { page: String(page + 1) })}`} className="text-interactive-primary hover:underline">
                {t("nextPage")}
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
