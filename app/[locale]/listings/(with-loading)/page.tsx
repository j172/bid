import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { listOpenListings, type ListingType } from "@/lib/listings";
import { listLatestFeaturedLoftPosts } from "@/lib/featuredLoftPosts";
import { listHomepageSections, getHomepageSectionById } from "@/lib/homepageSections";
import { currencyForLocale, formatDualPrice, formatNtd } from "@/lib/currency";
import { featuredLoftPostImageUrl } from "@/lib/uploads";
import { excerptHtml } from "@/lib/htmlText";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { getLatestStoredRate } from "@/lib/exchangeRates";
import { formatRemaining } from "@/lib/format";
import { maskDisplayName } from "@/lib/mask";
import { absoluteUrl, canonicalListingsUrl, hreflangAlternates } from "@/lib/seo";
import {
  countByCategory,
  filterListings,
  listingsHref,
  parseSortKey,
  sortListings,
  type ListingCategory,
} from "@/lib/listingFilters";
import { firstParam, numberParam, type SearchParams } from "@/lib/searchParams";
import { Link } from "@/i18n/navigation";
import CategorySelect, { type CategorySelectOption } from "../../components/CategorySelect";
import ProductCard from "../../components/ProductCard";
import PartnerLoftImage from "../../components/PartnerLoftImage";
import ContentCardGrid from "../../components/ContentCardGrid";
import { listPigeonShowcase } from "@/lib/pigeonShowcase";
import { isPigeonShowcaseCategory, type PigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";
import { pigeonShowcaseImageUrl } from "@/lib/uploads";
import {
  countShowcaseByCategory,
  resolveLoftActiveTab,
  resolveLoftStatusScope,
  type LoftActiveTab,
} from "@/lib/loftStorefront";

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
  const loftId = numberParam(sp.loft);
  const t = await getTranslations({ locale, namespace: "listings" });
  const query = rawType === "auction" || rawType === "fixed_price" ? { type: rawType } : undefined;
  const alternates = {
    canonical: canonicalListingsUrl(locale, sp),
    languages: hreflangAlternates("/listings", query),
  };

  if (loftId !== undefined) {
    const selectedLoft = await getHomepageSectionById(loftId);
    if (selectedLoft) {
      const activeTab = resolveLoftActiveTab(firstParam(sp.tab));
      const title =
        activeTab === "showcase"
          ? `${selectedLoft.title} - ${t("tabLoftShowcase")} | ${t("title")}`
          : `${selectedLoft.title} - ${t("title")}`;
      const description = selectedLoft.bio || t("metaDescriptionAll");
      const imageUrl = selectedLoft.imageFileName
        ? absoluteUrl(`/uploads/sections/${selectedLoft.imageFileName}`)
        : absoluteUrl("/images/logo.png");
      return {
        title,
        description,
        alternates,
        openGraph: {
          title,
          description,
          images: [{ url: imageUrl }],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [imageUrl],
        },
      };
    }
  }

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
  const activeTab: LoftActiveTab = resolveLoftActiveTab(firstParam(params.tab));
  const rawShowcaseCat = firstParam(params.showcaseCategory);
  const showcaseCategory: PigeonShowcaseCategory | undefined =
    isPigeonShowcaseCategory(rawShowcaseCat) ? rawShowcaseCat : undefined;

  // Powers the homepage partner-loft card click-through: /listings?loft=<id>
  // (issue #45 — replaces the removed homepage_sections.link_url), and now
  // (issue #178) the filter card's own 合作鴿舍 dropdown below.
  const loftId = numberParam(params.loft);
  const selectedLoftId = loftId !== undefined ? String(loftId) : "";
  const selectedLoft = loftId !== undefined ? await getHomepageSectionById(loftId) : null;

  // "scheduled" filters open/scheduled listings for the homepage card.
  // "closed" or "all" switch statusScope to include historical ended items.
  // Issue #200: When viewing a partner loft, default statusScope to "all" (both open
  // and closed) so visitors immediately see the loft's full history, preventing
  // false-empty pages when current auctions have ended.
  const rawStatus = firstParam(params.status);
  const statusScope = resolveLoftStatusScope(loftId, rawStatus);
  const statusFilter = rawStatus === "scheduled" ? "scheduled" : undefined;
  const withinHours = numberParam(params.withinHours);
  const perfMode = perfModeFromSearchParams(params);
  const gridEagerCount = perfMode === "aggressive" ? 6 : 4;

  const listings = await listOpenListings(type, { loftId, statusScope });

  // Issue #200: Fetch pigeon showcase items belonging to this loft
  const showcaseData =
    loftId !== undefined
      ? await listPigeonShowcase({ loftId, pageSize: 100 })
      : { items: [], total: 0 };
  const allShowcaseItems = showcaseData.items;
  const showcaseTotal = showcaseData.total;
  const showcaseCategoryCounts = countShowcaseByCategory(allShowcaseItems);
  const filteredShowcaseItems = showcaseCategory
    ? allShowcaseItems.filter((item) => item.category === showcaseCategory)
    : allShowcaseItems;

  // Same source as the homepage/`/featured-lofts` partner-loft lists (issue
  // #178) — options show loft title only, no per-loft listing counts.
  const partnerLofts = await listHomepageSections("partner_loft", { activeOnly: true });
  // 名家專區 (issue #176) — replaces issue #168's homepage_sections-based
  // cards with the new featured_loft_posts table; same full-width card grid
  // shown above the filters + listing grid two-column layout below (position
  // deliberately unchanged from #168 — only the data source and each card's
  // link target changed, see the JSX below).
  const FEATURED_LOFTS_GRID_LIMIT = 8;
  const featuredLoftPosts = await listLatestFeaturedLoftPosts(FEATURED_LOFTS_GRID_LIMIT);
  const t = await getTranslations("listings");
  const tPigeonShowcase = await getTranslations("pigeonShowcase");
  const tNav = await getTranslations("nav");
  const tFormat = await getTranslations("format");
  const anonymousBuyer = await getTranslations("mask").then((tMask) => tMask("anonymousBuyer"));

  const PIGEON_CATEGORY_TITLE_KEY: Record<PigeonShowcaseCategory, "awardTitle" | "importedTitle" | "representativeTitle"> = {
    award: "awardTitle",
    imported: "importedTitle",
    representative: "representativeTitle",
  };

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

  /**
   * Current filter set with `partial` applied on top — the single link
   * builder for every facet in the filter card (type/category/loft dropdowns
   * below), so switching one always carries the other two forward (issue
   * #178). Type, category, loft and tab mutually preserve each other by all
   * routing through this same reserved-param list.
   */
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
      loft: firstParam(params.loft),
      tab: firstParam(params.tab),
      showcaseCategory: firstParam(params.showcaseCategory),
      ...partial,
    });
  }

  // Each option's href deliberately drops status/withinHours — switching the
  // type filter exits any homepage-card-specific filtering rather than
  // compounding it (unchanged behavior from the old tabHref(), see issue
  // #178; category/loft below have no such exception).
  const TYPE_OPTIONS: CategorySelectOption[] = [
    { value: "", label: t("tabAll"), href: withFilters({ type: undefined, status: undefined, withinHours: undefined }) },
    {
      value: "auction",
      label: t("tabAuction"),
      href: withFilters({ type: "auction", status: undefined, withinHours: undefined }),
    },
    {
      value: "fixed_price",
      label: t("tabFixedPrice"),
      href: withFilters({ type: "fixed_price", status: undefined, withinHours: undefined }),
    },
  ];

  const CATEGORY_OPTIONS: CategorySelectOption[] = [
    { value: "", label: t("categoryAll"), href: withFilters({ category: undefined }) },
    {
      value: "auction",
      label: `${t("tabAuction")} (${categoryCounts.auction})`,
      href: withFilters({ category: "auction" }),
    },
    {
      value: "fixed_price",
      label: `${t("tabFixedPrice")} (${categoryCounts.fixed_price})`,
      href: withFilters({ category: "fixed_price" }),
    },
  ];

  const LOFT_OPTIONS: CategorySelectOption[] = [
    { value: "", label: t("loftAll"), href: withFilters({ loft: undefined, tab: undefined, showcaseCategory: undefined }) },
    ...partnerLofts.map((loft) => ({
      value: String(loft.id),
      label: loft.title,
      href: withFilters({ loft: String(loft.id), tab: undefined, showcaseCategory: undefined }),
    })),
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
          / {selectedLoft ? (
            <>
              <Link href="/listings" className="hover:text-interactive-primary">
                {t("title")}
              </Link>{" "}
              / {selectedLoft.title}
              {activeTab === "showcase" && (
                <>
                  {" "}
                  / {t("tabLoftShowcase")}
                </>
              )}
            </>
          ) : (
            t("title")
          )}
        </p>
        <h1 className="mt-2 text-3xl font-black text-ink">
          {selectedLoft ? selectedLoft.title : t("title")}
        </h1>
      </div>

      {selectedLoft && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-slate-100 shadow-sm sm:h-20 sm:w-20">
                {selectedLoft.imageFileName ? (
                  <PartnerLoftImage
                    src={`/uploads/sections/${selectedLoft.imageFileName}`}
                    alt={selectedLoft.title}
                    sizes="(min-width: 640px) 80px, 64px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-ink-light">
                    鴿
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-interactive-primary-subtle px-2.5 py-0.5 text-xs font-bold text-interactive-primary">
                    {t("loftTitle")}
                  </span>
                </div>
                <h2 className="mt-1 truncate text-2xl font-black text-ink sm:text-3xl">
                  {selectedLoft.title}
                </h2>
                {selectedLoft.bio && (
                  <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm text-ink-light">
                    {selectedLoft.bio}
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <Link
                href={withFilters({ loft: undefined, tab: undefined, showcaseCategory: undefined })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-bold text-ink transition hover:border-slate-300 hover:bg-slate-100"
              >
                <svg className="h-4 w-4 text-ink-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t("loftBannerAllListings")}
              </Link>
            </div>
          </div>

          {/* Top-level Major Tabs: 交易商品 vs 舍內名鴿 (issue #200) */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Link
              href={withFilters({ tab: undefined, showcaseCategory: undefined })}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                activeTab === "listings"
                  ? "bg-interactive-primary text-white shadow-sm"
                  : "bg-slate-100 text-ink-light hover:bg-slate-200"
              }`}
            >
              {t("tabLoftListings")} ({listings.length})
            </Link>
            <Link
              href={withFilters({ tab: "showcase", showcaseCategory: undefined })}
              className={`rounded-xl px-4 py-2 text-sm font-black transition ${
                activeTab === "showcase"
                  ? "bg-interactive-primary text-white shadow-sm"
                  : "bg-slate-100 text-ink-light hover:bg-slate-200"
              }`}
            >
              {t("tabLoftShowcase")} ({showcaseTotal})
            </Link>
          </div>

          {/* If listings tab is active: show the status filter sub-pills (在售中 / 已結標 / 全部) */}
          {activeTab === "listings" && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3">
              <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-ink-light">
                {t("statusTitle")}:
              </span>
              <Link
                href={withFilters({ status: "open" })}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  statusScope === "open" && !statusFilter
                    ? "bg-header text-white shadow-sm"
                    : "bg-slate-100 text-ink-light hover:bg-slate-200"
                }`}
              >
                {t("statusScopeActive")}
              </Link>
              <Link
                href={withFilters({ status: "closed" })}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  statusScope === "closed"
                    ? "bg-header text-white shadow-sm"
                    : "bg-slate-100 text-ink-light hover:bg-slate-200"
                }`}
              >
                {t("statusScopeClosed")}
              </Link>
              <Link
                href={withFilters({ status: "all" })}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  statusScope === "all"
                    ? "bg-header text-white shadow-sm"
                    : "bg-slate-100 text-ink-light hover:bg-slate-200"
                }`}
              >
                {t("statusScopeAll")}
              </Link>
            </div>
          )}
        </section>
      )}

      {featuredLoftPosts.length > 0 && (
        // Full-width, deliberately placed above the filters+grid two-column
        // layout below (not squeezed into the 280px sidebar) — layout/
        // styling unchanged from issue #168; only the data source
        // (featured_loft_posts, issue #176) and each card's link target
        // (its own /featured-lofts/<id> article instead of straight to
        // /listings?loft=<id>) changed.
        <section className="mt-6">
          <div className="mb-1 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t("featuredLoftsTitle")}</h2>
            <Link href="/featured-lofts" className="text-sm font-semibold text-interactive-primary hover:text-header">
              {t("featuredLoftsViewAll")}
            </Link>
          </div>
          <p className="text-sm text-ink-light">{t("featuredLoftsSubtitle")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {featuredLoftPosts.map((post) => (
              <Link
                key={post.id}
                href={`/featured-lofts/${post.id}`}
                className="group overflow-hidden rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100">
                  <PartnerLoftImage
                    src={post.imageFileName ? featuredLoftPostImageUrl(post.imageFileName) : IMAGE_FALLBACK_SRC}
                    alt={post.title}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                  />
                </div>
                <p className="mt-3 text-sm font-bold text-ink">{post.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-light">{excerptHtml(post.content, DESCRIPTION_SNIPPET_LENGTH)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {selectedLoft && activeTab === "showcase" ? (
        <section className="mt-6">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-xl font-black text-ink">{t("tabLoftShowcase")}</h3>
                <p className="mt-1 text-xs text-ink-light">
                  {selectedLoft.title}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={withFilters({ tab: "showcase", showcaseCategory: undefined })}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    !showcaseCategory
                      ? "bg-header text-white shadow-sm"
                      : "bg-surface-muted text-ink-light hover:bg-surface"
                  }`}
                >
                  {t("showcaseSubAll")} ({showcaseCategoryCounts.all})
                </Link>
                <Link
                  href={withFilters({ tab: "showcase", showcaseCategory: "award" })}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    showcaseCategory === "award"
                      ? "bg-header text-white shadow-sm"
                      : "bg-surface-muted text-ink-light hover:bg-surface"
                  }`}
                >
                  {t("showcaseSubAward")} ({showcaseCategoryCounts.award})
                </Link>
                <Link
                  href={withFilters({ tab: "showcase", showcaseCategory: "imported" })}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    showcaseCategory === "imported"
                      ? "bg-header text-white shadow-sm"
                      : "bg-surface-muted text-ink-light hover:bg-surface"
                  }`}
                >
                  {t("showcaseSubImported")} ({showcaseCategoryCounts.imported})
                </Link>
                <Link
                  href={withFilters({ tab: "showcase", showcaseCategory: "representative" })}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    showcaseCategory === "representative"
                      ? "bg-header text-white shadow-sm"
                      : "bg-surface-muted text-ink-light hover:bg-surface"
                  }`}
                >
                  {t("showcaseSubRepresentative")} ({showcaseCategoryCounts.representative})
                </Link>
              </div>
            </div>

            <ContentCardGrid
              items={filteredShowcaseItems.map((item) => ({
                id: item.id,
                href: `/pigeon-showcase/${item.id}`,
                imageUrl: item.imageFileName ? pigeonShowcaseImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC,
                title: item.name,
                badgeLabel: tPigeonShowcase(PIGEON_CATEGORY_TITLE_KEY[item.category]),
                excerpt: excerptHtml(item.description, 80),
              }))}
              emptyLabel={t("loftShowcaseEmpty")}
              viewDetailsLabel={t("viewShowcasePigeon")}
            />
          </div>
        </section>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px,1fr]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-wide text-ink">{t("filtersTitle")}</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{t("typeTitle")}</p>
                  <div className="mt-2">
                    <CategorySelect
                      ariaLabel={t("typeTitle")}
                      value={type ?? ""}
                      options={TYPE_OPTIONS}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{t("categoryTitle")}</p>
                  <div className="mt-2">
                    <CategorySelect
                      ariaLabel={t("categoryTitle")}
                      value={selectedCategory ?? ""}
                      options={CATEGORY_OPTIONS}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{t("loftTitle")}</p>
                  <div className="mt-2">
                    <CategorySelect
                      ariaLabel={t("loftTitle")}
                      value={selectedLoftId}
                      options={LOFT_OPTIONS}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink"
                    />
                  </div>
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
              {sortedListings.map((listing, index) => {
                const isClosed = listing.status === "closed";
                return (
                  <ProductCard
                    key={listing.id}
                    id={listing.id}
                    title={listing.title}
                    description={descriptionSnippet(listing.description)}
                    photo={listing.photos[0]}
                    typeBadgeLabel={isClosed ? t("badgeClosed") : TYPE_BADGE_LABEL[listing.listing_type]}
                    loftName={listing.loftName}
                    quickActionLabel={isClosed ? t("viewDetails") : t("quickAction")}
                    viewDetailsLabel={t("viewDetails")}
                    isClosed={isClosed}
                    priceText={
                      isClosed && listing.listing_type === "auction"
                        ? t("finalPrice", { price: formatNtd(listing.current_price) })
                        : formatDualPrice(
                            listing.listing_type === "fixed_price" ? listing.price! : listing.current_price,
                            displayCurrency,
                            rateValue,
                          )
                    }
                    detailLines={
                      isClosed
                        ? listing.listing_type === "fixed_price"
                          ? [
                              t("soldOut"),
                              t("totalPurchases", { count: listing.purchaseCount }),
                            ]
                          : [
                              listing.ends_at
                                ? formatRemaining(listing.ends_at, tFormat)
                                : t("statusEnded"),
                              listing.bidCount === 0
                                ? t("noBidsEnded")
                                : t("finalLeader", {
                                    name: maskDisplayName(listing.leaderDisplayName, anonymousBuyer),
                                  }),
                              t("totalBids", { count: listing.bidCount }),
                            ]
                        : listing.listing_type === "fixed_price"
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
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
