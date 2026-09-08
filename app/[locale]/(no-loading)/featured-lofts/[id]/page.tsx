import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getFeaturedLoftPostById, listLatestFeaturedLoftPosts } from "@/lib/featuredLoftPosts";
import { featuredLoftPostImageUrl, pigeonShowcaseImageUrl } from "@/lib/uploads";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { Link } from "@/i18n/navigation";
import {
  absoluteUrl,
  buildBreadcrumbListJsonLd,
  canonicalUrl,
  hreflangAlternates,
  stripHtmlToPlainText,
  truncateForMetaDescription,
} from "@/lib/seo";
import { safeJsonLdString } from "@/lib/jsonLdScript";
import { getHomepageSectionById } from "@/lib/homepageSections";
import {
  isListingsPageSize,
  listOpenListingsPaginated,
  LISTINGS_PAGE_SIZES,
  type ListingType,
} from "@/lib/listings";
import { listPigeonShowcase } from "@/lib/pigeonShowcase";
import type { PigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";
import { excerptHtml } from "@/lib/htmlText";
import { currencyForLocale, formatDualPrice, formatNtd } from "@/lib/currency";
import { getLatestStoredRate } from "@/lib/exchangeRates";
import { formatRemaining } from "@/lib/format";
import { maskDisplayName } from "@/lib/mask";
import { buildQuery, firstParam, type SearchParams } from "@/lib/searchParams";
import DetailWithSidebar from "../../../components/DetailWithSidebar";
import RichTextContent from "../../../components/RichTextContent";
import PaginationFooter from "../../../components/PaginationFooter";
import ProductCard from "../../../components/ProductCard";
import ContentCardGrid from "../../../components/ContentCardGrid";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) return {};

  const item = await getFeaturedLoftPostById(postId);
  if (!item) return {};

  const description = truncateForMetaDescription(stripHtmlToPlainText(item.content));
  const pathname = `/featured-lofts/${item.id}`;
  const imageUrl = item.imageFileName
    ? absoluteUrl(featuredLoftPostImageUrl(item.imageFileName))
    : absoluteUrl("/images/logo.png");

  return {
    title: item.title,
    description,
    alternates: {
      canonical: canonicalUrl(locale, pathname),
      languages: hreflangAlternates(pathname),
    },
    openGraph: {
      title: item.title,
      description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description,
      images: [imageUrl],
    },
  };
}

const SIDEBAR_LATEST_LIMIT = 5;
const DESCRIPTION_SNIPPET_LENGTH = 30;

function descriptionSnippet(description: string): string {
  const trimmed = description.trim();
  return trimmed.length > DESCRIPTION_SNIPPET_LENGTH
    ? `${trimmed.slice(0, DESCRIPTION_SNIPPET_LENGTH)}…`
    : trimmed;
}

const PIGEON_CATEGORY_TITLE_KEY: Record<
  PigeonShowcaseCategory,
  "awardTitle" | "importedTitle" | "representativeTitle"
> = {
  award: "awardTitle",
  imported: "importedTitle",
  representative: "representativeTitle",
};

const QUERY_KEYS = ["tab", "pageSize", "page"] as const;

export default async function FeaturedLoftPostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isFinite(postId)) {
    notFound();
  }

  const item = await getFeaturedLoftPostById(postId);
  if (!item) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const t = await getTranslations("featuredLofts");
  const sidebarItems = (await listLatestFeaturedLoftPosts(SIDEBAR_LATEST_LIMIT + 1))
    .filter((candidate) => candidate.id !== item.id)
    .slice(0, SIDEBAR_LATEST_LIMIT);

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd([
    { name: t("breadcrumbHome"), pathname: "/" },
    { name: t("title"), pathname: "/featured-lofts" },
    { name: item.title, pathname: `/featured-lofts/${item.id}` },
  ]);

  // If this post is linked to a partner loft, fetch that loft's pigeons & metadata
  const loft = item.loftId !== null ? await getHomepageSectionById(item.loftId) : null;
  const hasLoft = item.loftId !== null && loft !== null;

  const tabRaw = firstParam(resolvedSearchParams.tab);
  const activeTab: "listings" | "showcase" = tabRaw === "showcase" ? "showcase" : "listings";
  const page = Math.max(1, Number(firstParam(resolvedSearchParams.page) ?? "1") || 1);
  const pageSizeRaw = Number(firstParam(resolvedSearchParams.pageSize));
  const pageSize = isListingsPageSize(pageSizeRaw) ? pageSizeRaw : 30;

  let listings: Awaited<ReturnType<typeof listOpenListingsPaginated>>["items"] = [];
  let listingsTotal = 0;
  let showcaseItems: Awaited<ReturnType<typeof listPigeonShowcase>>["items"] = [];
  let showcaseTotal = 0;

  if (hasLoft) {
    if (activeTab === "listings") {
      const paginatedListings = await listOpenListingsPaginated(undefined, {
        loftId: item.loftId!,
        statusScope: "all",
        page,
        pageSize,
        orderByMode: "loft_newest",
      });
      listings = paginatedListings.items;
      listingsTotal = paginatedListings.total;

      const showcaseCountQuery = await listPigeonShowcase({
        loftId: item.loftId!,
        pageSize: 30,
      });
      showcaseTotal = showcaseCountQuery.total;
    } else {
      const paginatedShowcase = await listPigeonShowcase({
        loftId: item.loftId!,
        page,
        pageSize,
      });
      showcaseItems = paginatedShowcase.items;
      showcaseTotal = paginatedShowcase.total;

      const listingsCountQuery = await listOpenListingsPaginated(undefined, {
        loftId: item.loftId!,
        statusScope: "all",
        page: 1,
        pageSize: 30,
      });
      listingsTotal = listingsCountQuery.total;
    }
  }

  const currentTotal = activeTab === "listings" ? listingsTotal : showcaseTotal;
  const totalPages = Math.max(1, Math.ceil(currentTotal / pageSize));

  const locale = await getLocale();
  const displayCurrencies = currencyForLocale(locale);
  const currencyRates = await Promise.all(
    displayCurrencies.map(async (currency) => ({
      currency,
      rate: currency === "TWD" ? null : ((await getLatestStoredRate(currency))?.rate ?? null),
    })),
  );

  const tListings = await getTranslations("listings");
  const tPigeonShowcase = await getTranslations("pigeonShowcase");
  const tFormat = await getTranslations("format");
  const anonymousBuyer = await getTranslations("mask").then((tMask) => tMask("anonymousBuyer"));

  const TYPE_BADGE_LABEL: Record<ListingType, string> = {
    auction: tListings("badgeAuction"),
    fixed_price: tListings("badgeFixedPrice"),
  };

  const buildLoftPigeonHref = (overrides: Record<string, string>) => {
    const q = buildQuery(resolvedSearchParams, QUERY_KEYS, overrides);
    return `/featured-lofts/${item.id}${q ? `?${q}` : ""}#loft-pigeons`;
  };

  return (
    <DetailWithSidebar
      breadcrumb={
        <>
          <Link href="/" className="hover:text-interactive-primary">
            {t("breadcrumbHome")}
          </Link>{" "}
          /{" "}
          <Link href="/featured-lofts" className="hover:text-interactive-primary">
            {t("title")}
          </Link>{" "}
          / {item.title}
        </>
      }
      sidebarTitle={t("sidebarLatest")}
      sidebarItems={sidebarItems.map((sidebarItem) => ({
        id: sidebarItem.id,
        href: `/featured-lofts/${sidebarItem.id}`,
        primary: sidebarItem.title,
        secondary: sidebarItem.createdAt.toLocaleDateString(),
      }))}
      sidebarEmptyLabel={t("noItems")}
      backHref="/featured-lofts"
      backLabel={t("backToList")}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageFileName ? featuredLoftPostImageUrl(item.imageFileName) : IMAGE_FALLBACK_SRC}
        alt={item.title}
        loading="eager"
        fetchPriority="high"
        className="max-h-96 w-full rounded-xl object-cover"
      />
      <h1 className="mt-6 text-3xl font-black text-ink">{item.title}</h1>
      <p className="mt-2 text-sm font-semibold text-ink-light">
        {t("publishedLine", { date: item.createdAt.toLocaleString() })}
      </p>
      <RichTextContent html={item.content} className="mt-6 border-t border-border pt-6 leading-7 text-ink-light" />
      {hasLoft && (
        <a
          href="#loft-pigeons"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-header px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-twilight-indigo-600"
        >
          {t("browseLoftPigeons")} ↓
        </a>
      )}

      {hasLoft && (
        <section id="loft-pigeons" className="mt-12 scroll-mt-20 border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-ink">
              {t("loftPigeonsTitle", { loft: loft.title })}
            </h2>
            <Link
              href={`/listings?loft=${item.loftId}`}
              className="text-sm font-semibold text-interactive-primary hover:underline"
            >
              {t("openInStore")}
            </Link>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex border-b border-border text-sm font-medium">
            <Link
              href={buildLoftPigeonHref({ tab: "listings", page: "1" })}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "listings"
                  ? "border-interactive-primary font-bold text-interactive-primary"
                  : "border-transparent text-ink-light hover:text-ink"
              }`}
            >
              <span>{t("tabListings")}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-ink-light">
                {listingsTotal}
              </span>
            </Link>
            <Link
              href={buildLoftPigeonHref({ tab: "showcase", page: "1" })}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
                activeTab === "showcase"
                  ? "border-interactive-primary font-bold text-interactive-primary"
                  : "border-transparent text-ink-light hover:text-ink"
              }`}
            >
              <span>{t("tabShowcase")}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-ink-light">
                {showcaseTotal}
              </span>
            </Link>
          </div>

          {/* Tab Content */}
          {activeTab === "listings" ? (
            listings.length === 0 ? (
              <p className="mt-8 text-ink-light">{t("noListingsInLoft")}</p>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {listings.map((listing) => {
                  const isClosed = listing.status === "closed";
                  return (
                    <ProductCard
                      key={listing.id}
                      id={listing.id}
                      title={listing.title}
                      description={descriptionSnippet(listing.description)}
                      photo={listing.photos[0]}
                      typeBadgeLabel={
                        isClosed ? tListings("badgeClosed") : TYPE_BADGE_LABEL[listing.listing_type]
                      }
                      loftName={listing.loftName}
                      quickActionLabel={isClosed ? tListings("viewDetails") : tListings("quickAction")}
                      viewDetailsLabel={tListings("viewDetails")}
                      isClosed={isClosed}
                      priceText={
                        isClosed && listing.listing_type === "auction"
                          ? tListings("finalPrice", { price: formatNtd(listing.current_price) })
                          : formatDualPrice(
                              listing.listing_type === "fixed_price"
                                ? listing.price!
                                : listing.current_price,
                              currencyRates,
                            )
                      }
                      detailLines={
                        isClosed
                          ? listing.listing_type === "fixed_price"
                            ? [
                                tListings("soldOut"),
                                tListings("totalPurchases", { count: listing.purchaseCount }),
                              ]
                            : [
                                listing.ends_at
                                  ? formatRemaining(listing.ends_at, tFormat)
                                  : tListings("statusEnded"),
                                listing.bidCount === 0
                                  ? tListings("noBidsEnded")
                                  : tListings("finalLeader", {
                                      name: maskDisplayName(listing.leaderDisplayName, anonymousBuyer),
                                    }),
                                tListings("totalBids", { count: listing.bidCount }),
                              ]
                          : listing.listing_type === "fixed_price"
                            ? [
                                listing.stock_remaining === 0
                                  ? tListings("soldOut")
                                  : tListings("remainingUnits", {
                                      count: listing.stock_remaining ?? 0,
                                    }),
                                tListings("totalPurchases", { count: listing.purchaseCount }),
                              ]
                            : listing.status === "scheduled" && listing.starts_at
                              ? [
                                  formatRemaining(listing.starts_at, tFormat, {
                                    prefixKey: "startsInPrefix",
                                    endedKey: "startingSoon",
                                  }),
                                ]
                              : [
                                  listing.ends_at
                                    ? formatRemaining(listing.ends_at, tFormat)
                                    : tListings("statusEnded"),
                                  tListings("totalBids", { count: listing.bidCount }),
                                ]
                      }
                      eager={false}
                      highPriorityImage={false}
                    />
                  );
                })}
              </div>
            )
          ) : (
            <ContentCardGrid
              items={showcaseItems.map((showcaseItem) => ({
                id: showcaseItem.id,
                href: `/pigeon-showcase/${showcaseItem.id}`,
                imageUrl: showcaseItem.imageFileName
                  ? pigeonShowcaseImageUrl(showcaseItem.imageFileName)
                  : IMAGE_FALLBACK_SRC,
                title: showcaseItem.name,
                badgeLabel: tPigeonShowcase(PIGEON_CATEGORY_TITLE_KEY[showcaseItem.category]),
                excerpt: excerptHtml(showcaseItem.description, 80),
              }))}
              emptyLabel={t("noShowcaseInLoft")}
              viewDetailsLabel={tListings("viewShowcasePigeon")}
            />
          )}

          {/* Pagination Footer */}
          {currentTotal > 0 && (
            <PaginationFooter
              pageSizes={LISTINGS_PAGE_SIZES}
              pageSize={pageSize}
              page={page}
              totalPages={totalPages}
              pageSizeHref={(size) => buildLoftPigeonHref({ pageSize: String(size), page: "1" })}
              pageHref={(target) => buildLoftPigeonHref({ page: String(target) })}
              labels={{
                pageSizeLabel: t("pageSizeLabel"),
                prevPage: t("prevPage"),
                nextPage: t("nextPage"),
                pageInfo: t("pageInfo", { page, totalPages, total: currentTotal }),
              }}
            />
          )}
        </section>
      )}
    </DetailWithSidebar>
  );
}
