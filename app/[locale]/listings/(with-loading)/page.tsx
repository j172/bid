import { getLocale, getTranslations } from "next-intl/server";
import { listOpenListings, type ListingType } from "@/lib/listings";
import { currencyForLocale, formatDualPrice, formatNtd } from "@/lib/currency";
import { getLatestStoredRate } from "@/lib/exchangeRates";
import { formatRemaining } from "@/lib/format";
import { maskDisplayName } from "@/lib/mask";
import { Link } from "@/i18n/navigation";
import ProductCard from "../../components/ProductCard";

export const dynamic = "force-dynamic";

const DESCRIPTION_SNIPPET_LENGTH = 30;

type SearchParams = Record<string, string | string[] | undefined>;

type CategoryKey = "auction" | "fixed_price";
// ends_soon / starts_soon power the homepage "分類瀏覽" cards
// (see app/[locale]/(with-loading)/page.tsx) — real, computable subsets/orderings rather
// than the hardcoded links that used to live there.
type SortKey = "newest" | "price_asc" | "price_desc" | "ends_soon" | "starts_soon";

function inferCategoryFromListingType(type: ListingType): CategoryKey {
  return type === "auction" ? "auction" : "fixed_price";
}

function parseNumberParam(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function perfModeFromSearchParams(params: SearchParams): "balanced" | "aggressive" {
  const modeParam = params.perf;
  const mode = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  return mode === "aggressive" ? "aggressive" : "balanced";
}

function descriptionSnippet(description: string): string {
  const trimmed = description.trim();
  return trimmed.length > DESCRIPTION_SNIPPET_LENGTH
    ? `${trimmed.slice(0, DESCRIPTION_SNIPPET_LENGTH)}…`
    : trimmed;
}

function tabHref(
  tabValue: ListingType | "",
  perfMode: "balanced" | "aggressive",
  searchQuery?: string,
  sort?: SortKey,
): string {
  const sp = new URLSearchParams();

  if (tabValue) sp.set("type", tabValue);
  if (perfMode === "aggressive") sp.set("perf", "aggressive");
  if (searchQuery?.trim()) sp.set("q", searchQuery.trim());
  if (sort && sort !== "newest") sp.set("sort", sort);
  // Deliberately drop status/withinHours here — switching the type tab
  // exits any homepage-card-specific filtering rather than compounding it.

  const query = sp.toString();
  return query ? `/listings?${query}` : "/listings";
}

export default async function ListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const typeParam = params.type;
  const categoryParam = params.category;
  const selectedCategory = (Array.isArray(categoryParam) ? categoryParam[0] : categoryParam) as CategoryKey | undefined;
  const minPrice = parseNumberParam(params.minPrice);
  const maxPrice = parseNumberParam(params.maxPrice);
  const type = (Array.isArray(typeParam) ? typeParam[0] : typeParam) as ListingType | undefined;
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const searchQuery = rawQ?.trim() ?? "";
  const rawSort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort: SortKey =
    rawSort === "price_asc" ||
    rawSort === "price_desc" ||
    rawSort === "ends_soon" ||
    rawSort === "starts_soon"
      ? rawSort
      : "newest";
  // Only "scheduled" is a supported value today (powers the homepage's
  // "即將開賣" card) — anything else is treated as no status filter.
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const statusFilter = rawStatus === "scheduled" ? "scheduled" : undefined;
  const withinHours = parseNumberParam(params.withinHours);
  const perfMode = perfModeFromSearchParams(params);
  const gridEagerCount = perfMode === "aggressive" ? 6 : 4;
  // Powers the homepage partner-loft card click-through: /listings?loft=<id>
  // (issue #45 — replaces the removed homepage_sections.link_url).
  const loftId = parseNumberParam(params.loft);

  const listings = await listOpenListings(type, { loftId });
  const t = await getTranslations("listings");
  const tNav = await getTranslations("nav");
  const tFormat = await getTranslations("format");
  const anonymousBuyer = await getTranslations("mask").then((tMask) => tMask("anonymousBuyer"));

  // Reference-only currency conversion (issue #45) — see the listing detail
  // page's equivalent comment; admin stays pure NTD, this grid is public.
  const locale = await getLocale();
  const displayCurrency = currencyForLocale(locale);
  const displayRate = displayCurrency === "TWD" ? null : await getLatestStoredRate(displayCurrency);
  const rateValue = displayRate?.rate ?? null;

  const nowMs = new Date().getTime();
  const filteredListings = listings.filter((listing) => {
    const categoryMatch = !selectedCategory || inferCategoryFromListingType(listing.listing_type) === selectedCategory;
    const price = listing.listing_type === "auction" ? listing.current_price : (listing.price ?? listing.current_price);
    const minMatch = minPrice === undefined || price >= minPrice;
    const maxMatch = maxPrice === undefined || price <= maxPrice;
    const searchMatch =
      searchQuery.length === 0 ||
      `${listing.title} ${listing.description}`.toLowerCase().includes(searchQuery.toLowerCase());
    const statusMatch = !statusFilter || listing.status === statusFilter;
    const withinHoursMatch =
      withinHours === undefined ||
      (listing.listing_type === "auction" &&
        listing.status === "open" &&
        listing.ends_at !== null &&
        listing.ends_at.getTime() - nowMs >= 0 &&
        listing.ends_at.getTime() - nowMs <= withinHours * 60 * 60 * 1000);
    return categoryMatch && minMatch && maxMatch && searchMatch && statusMatch && withinHoursMatch;
  });

  const sortedListings = [...filteredListings].sort((a, b) => {
    const priceA = a.listing_type === "auction" ? a.current_price : (a.price ?? a.current_price);
    const priceB = b.listing_type === "auction" ? b.current_price : (b.price ?? b.current_price);

    if (sort === "price_asc") return priceA - priceB;
    if (sort === "price_desc") return priceB - priceA;
    if (sort === "ends_soon") {
      const aTime = a.ends_at ? a.ends_at.getTime() : Infinity;
      const bTime = b.ends_at ? b.ends_at.getTime() : Infinity;
      return aTime - bTime;
    }
    if (sort === "starts_soon") {
      const aTime = a.starts_at ? a.starts_at.getTime() : Infinity;
      const bTime = b.starts_at ? b.starts_at.getTime() : Infinity;
      return aTime - bTime;
    }
    return b.id - a.id;
  });

  const categoryCounts = listings.reduce(
    (acc, listing) => {
      const key = inferCategoryFromListingType(listing.listing_type);
      acc[key] += 1;
      return acc;
    },
    { auction: 0, fixed_price: 0 } satisfies Record<CategoryKey, number>,
  );

  function withFilters(partial: Record<string, string | undefined>): string {
    const sp = new URLSearchParams();
    const perf = Array.isArray(params.perf) ? params.perf[0] : params.perf;
    const currentType = Array.isArray(params.type) ? params.type[0] : params.type;
    const currentCategory = Array.isArray(params.category) ? params.category[0] : params.category;
    const currentMin = Array.isArray(params.minPrice) ? params.minPrice[0] : params.minPrice;
    const currentMax = Array.isArray(params.maxPrice) ? params.maxPrice[0] : params.maxPrice;
    const currentQ = Array.isArray(params.q) ? params.q[0] : params.q;
    const currentSort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
    const currentStatus = Array.isArray(params.status) ? params.status[0] : params.status;
    const currentWithinHours = Array.isArray(params.withinHours) ? params.withinHours[0] : params.withinHours;

    const next = {
      perf,
      type: currentType,
      category: currentCategory,
      minPrice: currentMin,
      maxPrice: currentMax,
      q: currentQ,
      sort: currentSort,
      status: currentStatus,
      withinHours: currentWithinHours,
      ...partial,
    };

    Object.entries(next).forEach(([key, value]) => {
      if (value) sp.set(key, value);
    });

    const query = sp.toString();
    return query ? `/listings?${query}` : "/listings";
  }

  const TYPE_TABS: { value: ListingType | ""; label: string }[] = [
    { value: "", label: t("tabAll") },
    { value: "auction", label: t("tabAuction") },
    { value: "fixed_price", label: t("tabFixedPrice") },
  ];

  const TYPE_BADGE_LABEL: Record<ListingType, string> = {
    auction: t("badgeAuction"),
    fixed_price: t("badgeFixedPrice"),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
          <Link href="/" className="hover:text-interactive-primary">
            {tNav("home")}
          </Link>{" "}
          / {t("title")}
        </p>
        <h1 className="mt-2 text-3xl font-black text-ink">{t("title")}</h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-ink">{t("filtersTitle")}</p>
            <div className="mt-4 space-y-2">
              {TYPE_TABS.map((tab) => (
                <Link
                  key={tab.value}
                  href={tabHref(tab.value, perfMode, searchQuery, sort)}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    (type ?? "") === tab.value
                      ? "bg-interactive-primary-subtle text-interactive-primary-active"
                      : "bg-slate-50 text-ink-light hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{t("categoryTitle")}</p>
              <div className="mt-2 space-y-2">
                <Link href={withFilters({ category: undefined })} className={`block rounded-md px-3 py-2 text-sm ${!selectedCategory ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("categoryAll")}
                </Link>
                <Link href={withFilters({ category: "auction" })} className={`block rounded-md px-3 py-2 text-sm ${selectedCategory === "auction" ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("tabAuction")} ({categoryCounts.auction})
                </Link>
                <Link href={withFilters({ category: "fixed_price" })} className={`block rounded-md px-3 py-2 text-sm ${selectedCategory === "fixed_price" ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("tabFixedPrice")} ({categoryCounts.fixed_price})
                </Link>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{t("priceTitle")}</p>
              <div className="mt-2 space-y-2">
                <Link href={withFilters({ minPrice: undefined, maxPrice: undefined })} className={`block rounded-md px-3 py-2 text-sm ${minPrice === undefined && maxPrice === undefined ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("priceAny")}
                </Link>
                <Link href={withFilters({ minPrice: "501", maxPrice: "1000" })} className={`block rounded-md px-3 py-2 text-sm ${minPrice === 501 && maxPrice === 1000 ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("priceMid")}
                </Link>
                <Link href={withFilters({ minPrice: "1001", maxPrice: undefined })} className={`block rounded-md px-3 py-2 text-sm ${minPrice === 1001 && maxPrice === undefined ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("priceHigh")}
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-ink">{t("guideTitle")}</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-ink-light">
              <li>{t("guideOne")}</li>
              <li>{t("guideTwo")}</li>
              <li>{t("guideThree")}</li>
            </ul>
          </div>
        </aside>

        <section>
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-ink-light">{t("showingCount", { count: filteredListings.length })}</p>
              {searchQuery.length > 0 && (
                <p className="truncate text-xs text-ink-light">
                  {t("searchPrefix")}
                  {searchQuery}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-light">{t("sortLabel")}</span>
              <Link
                href={withFilters({ sort: undefined })}
                className={`rounded-md px-2 py-1 text-xs font-medium ${sort === "newest" ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-100 text-ink-light hover:bg-slate-200"}`}
              >
                {t("sortNewest")}
              </Link>
              <Link
                href={withFilters({ sort: "price_asc" })}
                className={`rounded-md px-2 py-1 text-xs font-medium ${sort === "price_asc" ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-100 text-ink-light hover:bg-slate-200"}`}
              >
                {t("sortPriceAsc")}
              </Link>
              <Link
                href={withFilters({ sort: "price_desc" })}
                className={`rounded-md px-2 py-1 text-xs font-medium ${sort === "price_desc" ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-100 text-ink-light hover:bg-slate-200"}`}
              >
                {t("sortPriceDesc")}
              </Link>
              <Link
                href={withFilters({ sort: "ends_soon", withinHours: undefined })}
                className={`rounded-md px-2 py-1 text-xs font-medium ${sort === "ends_soon" ? "bg-interactive-primary-subtle text-interactive-primary-active" : "bg-slate-100 text-ink-light hover:bg-slate-200"}`}
              >
                {t("sortEndsSoon")}
              </Link>
              <p className="ml-1 font-semibold text-ink">
                {type || statusFilter || withinHours !== undefined ? t("filtered") : t("allLive")}
              </p>
            </div>
          </div>

          {filteredListings.length === 0 && <p className="mt-6 text-ink-light">{t("noListings")}</p>}

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sortedListings.map((listing, index) => (
              <ProductCard
                key={listing.id}
                id={listing.id}
                title={listing.title}
                description={descriptionSnippet(listing.description)}
                photo={listing.photos[0]}
                typeBadgeLabel={TYPE_BADGE_LABEL[listing.listing_type]}
                loftName={listing.loftName}
                quickActionLabel={t("quickAction")}
                viewDetailsLabel={t("viewDetails")}
                priceText={formatDualPrice(
                  listing.listing_type === "fixed_price" ? listing.price! : listing.current_price,
                  displayCurrency,
                  rateValue,
                )}
                detailLines={
                  listing.listing_type === "fixed_price"
                    ? [
                        listing.stock_remaining === 0
                          ? t("soldOut")
                          : t("remainingUnits", { count: listing.stock_remaining ?? 0 }),
                        t("totalPurchases", { count: listing.purchaseCount }),
                      ]
                    : listing.status === "scheduled" && listing.starts_at
                      ? [
                          formatRemaining(listing.starts_at, tFormat, {
                            prefixKey: "startsInPrefix",
                            endedKey: "startingSoon",
                          }),
                        ]
                      : [
                          ...(listing.buy_it_now_price !== null
                            ? [t("buyItNowPrice", { price: formatNtd(listing.buy_it_now_price) })]
                            : []),
                          listing.ends_at ? formatRemaining(listing.ends_at, tFormat) : t("timeless"),
                          listing.bidCount === 0
                            ? t("noBidsYet")
                            : t("currentLeader", { name: maskDisplayName(listing.leaderDisplayName, anonymousBuyer) }),
                          t("totalBids", { count: listing.bidCount }),
                        ]
                }
                eager={index < gridEagerCount}
                highPriorityImage={index < 2}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
