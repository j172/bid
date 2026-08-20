import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { listOpenListings, type ListingType } from "@/lib/listings";
import { listHomepageSections } from "@/lib/homepageSections";
import { currencyForLocale, formatDualPrice, formatNtd } from "@/lib/currency";
import { homepageSectionImageUrl } from "@/lib/uploads";
import { getLatestStoredRate } from "@/lib/exchangeRates";
import { formatRemaining } from "@/lib/format";
import { maskDisplayName } from "@/lib/mask";
import { canonicalListingsUrl, hreflangAlternates } from "@/lib/seo";
import {
  countByCategory,
  filterListings,
  listingsHref,
  parseSortKey,
  sortListings,
  type ListingCategory,
  type ListingSortKey,
} from "@/lib/listingFilters";
import { firstParam, numberParam, type SearchParams } from "@/lib/searchParams";
import { Link } from "@/i18n/navigation";
import ProductCard from "../../components/ProductCard";
import PartnerLoftImage from "../../components/PartnerLoftImage";

export const dynamic = "force-dynamic";

const DESCRIPTION_SNIPPET_LENGTH = 30;

function perfModeFromSearchParams(params: SearchParams): "balanced" | "aggressive" {
  return firstParam(params.perf) === "aggressive" ? "aggressive" : "balanced";
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
  sort?: ListingSortKey,
): string {
  // Deliberately drops status/withinHours — switching the type tab exits any
  // homepage-card-specific filtering rather than compounding it.
  return listingsHref({
    type: tabValue || undefined,
    perf: perfMode === "aggressive" ? "aggressive" : undefined,
    q: searchQuery?.trim() || undefined,
    sort: sort && sort !== "newest" ? sort : undefined,
  });
}

// <title>/<meta description> for the listings list/category page (issue
// #107 item 1) — driven by the `type` filter (auction / fixed_price / all),
// the closest thing this site has to a "category" (see CategoryKey above).
// Other filters (search, price range, sort, ...) don't get their own
// metadata variant — they're view-only tweaks of the same logical page.
// Also carries hreflang (alternates.languages) and a canonical URL (issue
// #107 items 6-7): `type` is kept in both (it's a real category, not a
// cosmetic view), but every other query param (sort, q, minPrice/maxPrice,
// withinHours, loft, perf, page) is stripped from the canonical URL so
// those views all collapse onto the same canonical page instead of each
// looking like a distinct duplicate — see lib/seo.ts's canonicalListingsUrl.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const sp = await searchParams;
  const rawType = firstParam(sp.type);
  const t = await getTranslations({ locale, namespace: "listings" });
  const query = rawType === "auction" || rawType === "fixed_price" ? { type: rawType } : undefined;
  const alternates = {
    canonical: canonicalListingsUrl(locale, sp),
    languages: hreflangAlternates("/listings", query),
  };

  if (rawType === "auction") {
    return {
      title: `${t("tabAuction")} - ${t("title")}`,
      description: t("metaDescriptionAuction"),
      alternates,
    };
  }
  if (rawType === "fixed_price") {
    return {
      title: `${t("tabFixedPrice")} - ${t("title")}`,
      description: t("metaDescriptionFixedPrice"),
      alternates,
    };
  }
  return { title: t("title"), description: t("metaDescriptionAll"), alternates };
}

export default async function ListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const selectedCategory = firstParam(params.category) as ListingCategory | undefined;
  const minPrice = numberParam(params.minPrice);
  const maxPrice = numberParam(params.maxPrice);
  const type = firstParam(params.type) as ListingType | undefined;
  const searchQuery = firstParam(params.q)?.trim() ?? "";
  const sort = parseSortKey(firstParam(params.sort));
  // Only "scheduled" is a supported value today (powers the homepage's
  // "即將開賣" card) — anything else is treated as no status filter.
  const statusFilter = firstParam(params.status) === "scheduled" ? "scheduled" : undefined;
  const withinHours = numberParam(params.withinHours);
  const perfMode = perfModeFromSearchParams(params);
  const gridEagerCount = perfMode === "aggressive" ? 6 : 4;
  // Powers the homepage partner-loft card click-through: /listings?loft=<id>
  // (issue #45 — replaces the removed homepage_sections.link_url).
  const loftId = numberParam(params.loft);

  const listings = await listOpenListings(type, { loftId });
  // 名家專區 (issue #168) — independent homepage_sections section_type from
  // 合作鴿舍; same card grid/layout, shown full-width above the filters +
  // listing grid two-column layout below.
  const featuredLofts = await listHomepageSections("featured_loft", { activeOnly: true });
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

  const filteredListings = filterListings(listings, {
    category: selectedCategory,
    minPrice,
    maxPrice,
    searchQuery,
    status: statusFilter,
    withinHours,
    nowMs: new Date().getTime(),
  });
  const sortedListings = sortListings(filteredListings, sort);
  const categoryCounts = countByCategory(listings);

  /** Current filter set with `partial` applied on top — powers every facet link below. */
  function withFilters(partial: Record<string, string | undefined>): string {
    return listingsHref({
      perf: firstParam(params.perf),
      type: firstParam(params.type),
      category: firstParam(params.category),
      minPrice: firstParam(params.minPrice),
      maxPrice: firstParam(params.maxPrice),
      q: firstParam(params.q),
      sort: firstParam(params.sort),
      status: firstParam(params.status),
      withinHours: firstParam(params.withinHours),
      ...partial,
    });
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

      {featuredLofts.length > 0 && (
        // Full-width, deliberately placed above the filters+grid two-column
        // layout below (not squeezed into the 280px sidebar) — mirrors the
        // homepage 合作鴿舍 block's layout/styling exactly (issue #168).
        <section className="mt-6">
          <div className="mb-1 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t("featuredLoftsTitle")}</h2>
            <Link href="/listings" className="text-sm font-semibold text-interactive-primary hover:text-header">
              {t("featuredLoftsViewAll")}
            </Link>
          </div>
          <p className="text-sm text-ink-light">{t("featuredLoftsSubtitle")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {featuredLofts.map((loft) => (
              <Link
                key={loft.id}
                href={`/listings?loft=${loft.id}`}
                className="group overflow-hidden rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
                  <PartnerLoftImage
                    src={homepageSectionImageUrl(loft.imageFileName)}
                    alt={loft.title}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                  />
                </div>
                <p className="mt-3 text-sm font-bold text-ink">{loft.title}</p>
                {loft.bio && <p className="mt-1 line-clamp-2 text-xs text-ink-light">{loft.bio}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

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
