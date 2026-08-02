import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  getPigeonGalleryCategoryById,
  listPigeonGalleryItems,
  type GalleryPriceType,
  type GalleryType,
  type PigeonGalleryItem,
} from "@/lib/pigeonGallery";
import { pigeonGalleryItemImageUrl } from "@/lib/uploads";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const GALLERY_TYPES: GalleryType[] = ["award", "import"];

function isGalleryType(value: string): value is GalleryType {
  return (GALLERY_TYPES as string[]).includes(value);
}

type PriceRangeKey = "range1" | "range2" | "range3";

// Buckets from the Epic (#32) decision: 15,000-20,000 / 20,000-30,000 /
// 30,000以上, applied to reference_price. max: undefined means open-ended.
const PRICE_RANGES: Record<PriceRangeKey, { min: number; max?: number }> = {
  range1: { min: 15_000, max: 20_000 },
  range2: { min: 20_000, max: 30_000 },
  range3: { min: 30_000 },
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isPriceRangeKey(value: string | undefined): value is PriceRangeKey {
  return value === "range1" || value === "range2" || value === "range3";
}

function isPriceType(value: string | undefined): value is GalleryPriceType {
  return value === "auction" || value === "fixed_price";
}

export default async function PigeonGalleryCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ galleryType: string; categoryId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { galleryType: galleryTypeParam, categoryId: categoryIdParam } = await params;
  if (!isGalleryType(galleryTypeParam)) {
    notFound();
  }
  const galleryType = galleryTypeParam;

  const categoryId = Number(categoryIdParam);
  if (!Number.isFinite(categoryId)) {
    notFound();
  }

  const category = await getPigeonGalleryCategoryById(categoryId);
  if (!category || category.galleryType !== galleryType || !category.isActive) {
    notFound();
  }

  const sp = await searchParams;
  const priceTypeFilter = first(sp.type);
  const priceRangeFilter = first(sp.price);
  const selectedPriceType = isPriceType(priceTypeFilter) ? priceTypeFilter : undefined;
  const selectedPriceRange = isPriceRangeKey(priceRangeFilter) ? priceRangeFilter : undefined;

  const [t, items] = await Promise.all([getTranslations("pigeonGallery"), listPigeonGalleryItems(categoryId, { activeOnly: true })]);

  const filteredItems = items.filter((item) => {
    const typeMatch = !selectedPriceType || item.priceType === selectedPriceType;
    if (!selectedPriceRange) return typeMatch;
    const range = PRICE_RANGES[selectedPriceRange];
    const priceMatch = item.referencePrice >= range.min && (range.max === undefined || item.referencePrice <= range.max);
    return typeMatch && priceMatch;
  });

  const pageTitle =
    galleryType === "award" ? t("categoryTitleAward", { name: category.name }) : t("categoryTitleImport", { name: category.name });

  function withFilters(partial: { type?: string; price?: string }): string {
    const query = new URLSearchParams();
    const nextType = "type" in partial ? partial.type : selectedPriceType;
    const nextPrice = "price" in partial ? partial.price : selectedPriceRange;
    if (nextType) query.set("type", nextType);
    if (nextPrice) query.set("price", nextPrice);
    const queryString = query.toString();
    return queryString ? `/pigeons/${galleryType}/${categoryId}?${queryString}` : `/pigeons/${galleryType}/${categoryId}`;
  }

  const TYPE_FILTERS: { value: GalleryPriceType | undefined; label: string }[] = [
    { value: undefined, label: t("filterTypeAll") },
    { value: "auction", label: t("filterTypeAuction") },
    { value: "fixed_price", label: t("filterTypeFixed") },
  ];

  const PRICE_FILTERS: { value: PriceRangeKey | undefined; label: string }[] = [
    { value: undefined, label: t("filterPriceAny") },
    { value: "range1", label: t("filterPriceRange1") },
    { value: "range2", label: t("filterPriceRange2") },
    { value: "range3", label: t("filterPriceRange3") },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
          <Link href="/" className="hover:text-interactive-primary">
            {t("breadcrumbHome")}
          </Link>
          {" / "}
          {galleryType === "award" ? t("sectionAwardTitle") : t("sectionImportTitle")}
        </p>
        <h1 className="mt-2 text-3xl font-black text-ink">{pageTitle}</h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-ink">{t("filterTypeTitle")}</p>
            <div className="mt-3 space-y-2">
              {TYPE_FILTERS.map((filter) => (
                <Link
                  key={filter.label}
                  href={withFilters({ type: filter.value })}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    selectedPriceType === filter.value
                      ? "bg-interactive-primary-subtle text-interactive-primary-active"
                      : "bg-slate-50 text-ink-light hover:bg-slate-100"
                  }`}
                >
                  {filter.label}
                </Link>
              ))}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{t("filterPriceTitle")}</p>
              <div className="mt-2 space-y-2">
                {PRICE_FILTERS.map((filter) => (
                  <Link
                    key={filter.label}
                    href={withFilters({ price: filter.value })}
                    className={`block rounded-md px-3 py-2 text-sm ${
                      selectedPriceRange === filter.value
                        ? "bg-interactive-primary-subtle text-interactive-primary-active"
                        : "bg-slate-50 text-ink-light hover:bg-slate-100"
                    }`}
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-ink-light">{t("showingCount", { count: filteredItems.length })}</p>
          </div>

          {filteredItems.length === 0 && <p className="mt-6 text-ink-light">{t("emptyState")}</p>}

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item: PigeonGalleryItem) => (
              <article key={item.id} className="group rounded-2xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-interactive-primary/60 hover:shadow-md">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={pigeonGalleryItemImageUrl(item.imageFileName)}
                    alt={item.title}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-interactive-primary shadow-sm">
                    {item.priceType === "auction" ? t("filterTypeAuction") : t("filterTypeFixed")}
                  </span>
                </div>
                <h3 className="mt-3 truncate text-sm font-semibold text-ink">{item.title}</h3>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-lg font-black text-ink">{item.referencePrice.toLocaleString()}</p>
                  <p className="text-xs text-ink-light">{t("referencePriceLabel")}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
