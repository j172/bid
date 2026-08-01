import { getTranslations } from "next-intl/server";
import { listOpenListings, type ListingType } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { formatRemaining } from "@/lib/format";
import { maskDisplayName } from "@/lib/mask";
import { Link } from "@/i18n/navigation";
import ProductCard from "../components/ProductCard";

export const dynamic = "force-dynamic";

const DESCRIPTION_SNIPPET_LENGTH = 30;

type SearchParams = Record<string, string | string[] | undefined>;

type CategoryKey = "auction" | "fixed_price";

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

function tabHref(tabValue: ListingType | "", perfMode: "balanced" | "aggressive"): string {
  if (!tabValue) {
    return perfMode === "aggressive" ? "/listings?perf=aggressive" : "/listings";
  }
  return perfMode === "aggressive"
    ? `/listings?type=${tabValue}&perf=aggressive`
    : `/listings?type=${tabValue}`;
}

export default async function ListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const typeParam = params.type;
  const categoryParam = params.category;
  const selectedCategory = (Array.isArray(categoryParam) ? categoryParam[0] : categoryParam) as CategoryKey | undefined;
  const minPrice = parseNumberParam(params.minPrice);
  const maxPrice = parseNumberParam(params.maxPrice);
  const type = (Array.isArray(typeParam) ? typeParam[0] : typeParam) as ListingType | undefined;
  const perfMode = perfModeFromSearchParams(params);
  const gridEagerCount = perfMode === "aggressive" ? 6 : 4;

  const listings = await listOpenListings(type);
  const t = await getTranslations("listings");
  const tFormat = await getTranslations("format");
  const anonymousBuyer = await getTranslations("mask").then((tMask) => tMask("anonymousBuyer"));

  const filteredListings = listings.filter((listing) => {
    const categoryMatch = !selectedCategory || inferCategoryFromListingType(listing.listing_type) === selectedCategory;
    const price = listing.listing_type === "auction" ? listing.current_price : (listing.price ?? listing.current_price);
    const minMatch = minPrice === undefined || price >= minPrice;
    const maxMatch = maxPrice === undefined || price <= maxPrice;
    return categoryMatch && minMatch && maxMatch;
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

    const next = {
      perf,
      type: currentType,
      category: currentCategory,
      minPrice: currentMin,
      maxPrice: currentMax,
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
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">Home / Listings</p>
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
                  href={tabHref(tab.value, perfMode)}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    (type ?? "") === tab.value
                      ? "bg-gold-light text-gold-dark"
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
                <Link href={withFilters({ category: undefined })} className={`block rounded-md px-3 py-2 text-sm ${!selectedCategory ? "bg-gold-light text-gold-dark" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("categoryAll")}
                </Link>
                <Link href={withFilters({ category: "auction" })} className={`block rounded-md px-3 py-2 text-sm ${selectedCategory === "auction" ? "bg-gold-light text-gold-dark" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("tabAuction")} ({categoryCounts.auction})
                </Link>
                <Link href={withFilters({ category: "fixed_price" })} className={`block rounded-md px-3 py-2 text-sm ${selectedCategory === "fixed_price" ? "bg-gold-light text-gold-dark" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("tabFixedPrice")} ({categoryCounts.fixed_price})
                </Link>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{t("priceTitle")}</p>
              <div className="mt-2 space-y-2">
                <Link href={withFilters({ minPrice: undefined, maxPrice: undefined })} className={`block rounded-md px-3 py-2 text-sm ${minPrice === undefined && maxPrice === undefined ? "bg-gold-light text-gold-dark" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("priceAny")}
                </Link>
                <Link href={withFilters({ minPrice: "0", maxPrice: "500" })} className={`block rounded-md px-3 py-2 text-sm ${minPrice === 0 && maxPrice === 500 ? "bg-gold-light text-gold-dark" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("priceLow")}
                </Link>
                <Link href={withFilters({ minPrice: "501", maxPrice: "1000" })} className={`block rounded-md px-3 py-2 text-sm ${minPrice === 501 && maxPrice === 1000 ? "bg-gold-light text-gold-dark" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
                  {t("priceMid")}
                </Link>
                <Link href={withFilters({ minPrice: "1001", maxPrice: undefined })} className={`block rounded-md px-3 py-2 text-sm ${minPrice === 1001 && maxPrice === undefined ? "bg-gold-light text-gold-dark" : "bg-slate-50 text-ink-light hover:bg-slate-100"}`}>
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
          <div className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-ink-light">{t("showingCount", { count: filteredListings.length })}</p>
            <p className="font-semibold text-ink">{type ? t("filtered") : t("allLive")}</p>
          </div>

          {filteredListings.length === 0 && <p className="mt-6 text-ink-light">{t("noListings")}</p>}

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredListings.map((listing, index) => (
              <ProductCard
                key={listing.id}
                id={listing.id}
                title={listing.title}
                description={descriptionSnippet(listing.description)}
                photo={listing.photos[0]}
                typeBadgeLabel={TYPE_BADGE_LABEL[listing.listing_type]}
                quickActionLabel={t("quickAction")}
                viewDetailsLabel={t("viewDetails")}
                priceText={listing.listing_type === "fixed_price" ? String(listing.price) : String(listing.current_price)}
                detailLines={
                  listing.listing_type === "fixed_price"
                    ? [
                        listing.stock_remaining === 0
                          ? t("soldOut")
                          : t("remainingUnits", { count: listing.stock_remaining ?? 0 }),
                        t("totalPurchases", { count: listing.purchaseCount }),
                      ]
                    : [
                        ...(listing.buy_it_now_price !== null
                          ? [t("buyItNowPrice", { price: listing.buy_it_now_price })]
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
