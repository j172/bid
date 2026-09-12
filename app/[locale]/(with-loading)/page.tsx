import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { listOpenListings } from "@/lib/listings";
import { listingPhotoUrl, homepageSectionImageUrl, pigeonShowcaseImageUrl, newsImageUrl, featuredLoftPostImageUrl } from "@/lib/uploads";
import { listHomepageSections } from "@/lib/homepageSections";
import { listLatestPigeonShowcase } from "@/lib/pigeonShowcase";
import { listHomepageNewsCarousel } from "@/lib/news";
import { listLatestFeaturedLoftPosts } from "@/lib/featuredLoftPosts";
import { excerptHtml } from "@/lib/htmlText";
import { canonicalUrl, hreflangAlternates } from "@/lib/seo";
import { currencyForLocale, formatDualPrice, formatNtd } from "@/lib/currency";
import { getLatestStoredRate } from "@/lib/exchangeRates";
import { cachedQuery } from "@/lib/cache";
import { IMAGE_FALLBACK_SRC } from "@/lib/imageFallback";
import { firstParam, type SearchParams } from "@/lib/searchParams";
import {
  QUICK_CLOSE_WINDOW_HOURS,
  filterByListingType,
  selectEndingSoonAuctions,
  selectMostActive,
  selectNewestFixedPrice,
  selectQuickCloseAuctions,
  selectTopAuctionsByBids,
  selectTopFixedByPurchases,
  selectTopPriceAuctions,
} from "@/lib/homepageListings";
import { Link } from "@/i18n/navigation";
import HeroSection from "../components/HeroSection";
import HomeListingRow from "../components/HomeListingRow";
import HomeProductCard from "../components/HomeProductCard";
import PartnerLoftImage from "../components/PartnerLoftImage";
import PigeonShowcaseCarouselCard from "../components/PigeonShowcaseCarouselCard";
import NewsCarouselCard from "../components/NewsCarouselCard";
import FeaturedLoftCarouselCard from "../components/FeaturedLoftCarouselCard";
import ExchangeRateStrip from "../components/ExchangeRateStrip";
import SocialMediaSection from "../components/SocialMediaSection";
import { getSocialMediaFeed } from "@/lib/socialMedia";

export const dynamic = "force-dynamic";

/** Number of hero/grid images that load eagerly, per perf mode. */
const EAGER_COUNTS = { balanced: 1, aggressive: 2 } as const;

const ENDING_SOON_LIMIT = 5;
const TOP_PRICE_LIMIT = 2;
const QUICK_DEALS_LIMIT = 3;
const NEW_ARRIVALS_LIMIT = 8;
const MOST_ACTIVE_LIMIT = 6;
const TOP_BY_TYPE_LIMIT = 4;
const FIXED_PRICE_SECTION_LIMIT = 6;

// Homepage-specific alternates (issue #107 items 6-7) — deliberately not
// hoisted into the shared root layout's generateMetadata (app/[locale]/
// layout.tsx), since that layout wraps every page under [locale], and an
// alternates.languages/canonical pointing at "/" would be wrong for every
// other page that doesn't override it with its own generateMetadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      languages: hreflangAlternates("/"),
      canonical: canonicalUrl(locale, "/"),
    },
  };
}

type VisualCategoryItem = {
  label: string;
  subtitle: string;
  href: string;
  badge: string;
  count: number;
};

function perfModeFromSearchParams(params: SearchParams): "balanced" | "aggressive" {
  return firstParam(params.perf) === "aggressive" ? "aggressive" : "balanced";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const perfMode = perfModeFromSearchParams(params);
  const t = await getTranslations("home");
  const tListings = await getTranslations("listings");
  const tAutoBid = await getTranslations("autoBiddingInfo");
  // listOpenListings now also returns 'scheduled' (not-yet-started) auctions
  // for the /listings browse page's benefit — the homepage's curated
  // sections below (ending soon, quick deals, etc.) all assume "actively
  // biddable" semantics (bid counts, "剩餘 X" urgency framing), so they stay
  // open-only rather than growing their own scheduled-aware treatment. The
  // "分類瀏覽" cards are the one exception (see below) — they intentionally
  // surface scheduled listings too, so they keep the unfiltered result.
  const allFetchedListings = await cachedQuery("home:openListings", 20, () => listOpenListings());
  const listings = allFetchedListings.filter((item) => item.status === "open");
  const partnerLofts = await cachedQuery("home:partnerLofts", 20, () =>
    listHomepageSections("partner_loft", { activeOnly: true }),
  );
  // 名家專區首頁輪播 (issue #176) — replaces issue #168's static
  // homepage_sections('featured_loft') card grid with its own
  // featured_loft_posts table + a NewsCarouselCard-style rotating card
  // (see FeaturedLoftCarouselCard below). Latest 10, same "carousel of the
  // newest N" convention as 最新訊息/入賞鴿/進口鴿 below.
  const FEATURED_LOFT_CAROUSEL_EXCERPT_LENGTH = 30;
  const latestFeaturedLoftPosts = await cachedQuery("home:latestFeaturedLoftPosts", 20, () =>
    listLatestFeaturedLoftPosts(10),
  );
  const featuredLoftCarouselItems = latestFeaturedLoftPosts.map((post) => ({
    id: post.id,
    title: post.title,
    excerpt: excerptHtml(post.content, FEATURED_LOFT_CAROUSEL_EXCERPT_LENGTH),
    imageUrl: post.imageFileName ? featuredLoftPostImageUrl(post.imageFileName) : "/images/logo.png",
    createdAt: post.createdAt.toLocaleDateString(),
  }));

  // Reference-only currency conversion (issue #45, wired into the homepage
  // for issue #103; extended to multiple currencies per locale in issue
  // #154) — same pattern as the listings page and listing detail page: NTD
  // is always the authoritative price, this only picks which secondary "≈"
  // currencies (if any) to show alongside it for this locale.
  const locale = await getLocale();
  const displayCurrencies = currencyForLocale(locale);
  const currencyRates = await Promise.all(
    displayCurrencies.map(async (currency) => ({
      currency,
      rate:
        currency === "TWD"
          ? null
          : ((await cachedQuery(`home:rate:${currency}`, 20, () => getLatestStoredRate(currency)))?.rate ?? null),
    })),
  );
  // 入賞鴿／進口鴿／代表種鴿首頁輪播 (issue #54; 'representative' 代表種鴿卡片
  // added by issue #170) — latest 10 per category, feeding the three small
  // promo cards below (replacing their static marketing copy when
  // non-empty; see PigeonShowcaseCarouselCard's own fallback branch).
  const PIGEON_CAROUSEL_EXCERPT_LENGTH = 60;
  const [awardPigeons, importedPigeons, representativePigeons] = await Promise.all([
    cachedQuery("home:pigeonShowcase:award", 20, () => listLatestPigeonShowcase("award", 10)),
    cachedQuery("home:pigeonShowcase:imported", 20, () => listLatestPigeonShowcase("imported", 10)),
    cachedQuery("home:pigeonShowcase:representative", 20, () => listLatestPigeonShowcase("representative", 10)),
  ]);
  const awardCarouselItems = awardPigeons.map((pigeon) => ({
    id: pigeon.id,
    name: pigeon.name,
    excerpt: excerptHtml(pigeon.description, PIGEON_CAROUSEL_EXCERPT_LENGTH),
    imageUrl: pigeon.imageFileName ? pigeonShowcaseImageUrl(pigeon.imageFileName) : "/images/logo.png",
  }));
  const importedCarouselItems = importedPigeons.map((pigeon) => ({
    id: pigeon.id,
    name: pigeon.name,
    excerpt: excerptHtml(pigeon.description, PIGEON_CAROUSEL_EXCERPT_LENGTH),
    imageUrl: pigeon.imageFileName ? pigeonShowcaseImageUrl(pigeon.imageFileName) : "/images/logo.png",
  }));
  const representativeCarouselItems = representativePigeons.map((pigeon) => ({
    id: pigeon.id,
    name: pigeon.name,
    excerpt: excerptHtml(pigeon.description, PIGEON_CAROUSEL_EXCERPT_LENGTH),
    imageUrl: pigeon.imageFileName ? pigeonShowcaseImageUrl(pigeon.imageFileName) : "/images/logo.png",
  }));

  // 最新訊息首頁輪播 (issue #56, capped list logic extended by #240) — latest
  // 10 posts, manual announcements prioritized ahead of herbots.be imports
  // (see lib/news.ts's listHomepageNewsCarousel) — replacing the large
  // "現正競標／熱門競標正在進行" promo card below with a rotating
  // title+excerpt showcase (falls back to that card's original marketing
  // copy when there are currently zero news_posts rows; see
  // NewsCarouselCard's own fallback branch).
  const NEWS_CAROUSEL_EXCERPT_LENGTH = 30;
  const latestNews = await cachedQuery("home:latestNews", 20, () => listHomepageNewsCarousel(10));
  const newsCarouselItems = latestNews.map((post) => ({
    id: post.id,
    title: post.title,
    excerpt: excerptHtml(post.content, NEWS_CAROUSEL_EXCERPT_LENGTH),
    imageUrl: post.imageFileName ? newsImageUrl(post.imageFileName) : "/images/logo.png",
    // Same date convention as the news list and the news detail sidebar
    // (app/[locale]/news/page.tsx, app/[locale]/(no-loading)/news/[id]/page.tsx):
    // formatted here on the server so the client carousel card can't drift
    // from the server rendering during hydration (issue #146). Prefers the
    // article's original herbots.be publish date over this row's import
    // date, same as those other two callers (issue #240).
    createdAt: (post.publishedAt ?? post.createdAt).toLocaleDateString(),
  }));

  const socialItems = await getSocialMediaFeed();

  const heroRenderedAt = new Date().toISOString();
  const nowMs = new Date().getTime();

  // Every curated section below is a named rule in lib/homepageListings.ts
  // (issue #139 item 3) — see there for what each ordering means and why.
  const endingSoonAuctions = selectEndingSoonAuctions(listings, ENDING_SOON_LIMIT);
  const topPriceAuctions = selectTopPriceAuctions(listings, TOP_PRICE_LIMIT);
  const quickDeals = listings.slice(0, QUICK_DEALS_LIMIT);
  const newArrivals = listings.slice(0, NEW_ARRIVALS_LIMIT);
  const bestMixed = selectMostActive(listings, MOST_ACTIVE_LIMIT);
  const topAuctions = selectTopAuctionsByBids(listings, TOP_BY_TYPE_LIMIT);
  const topFixed = selectTopFixedByPurchases(listings, TOP_BY_TYPE_LIMIT);
  // Independent "定價種鴿" homepage section (issue #36) — renders nothing
  // when there are none (see JSX below).
  const fixedPriceListings = selectNewestFixedPrice(listings, FIXED_PRICE_SECTION_LIMIT);

  // "分類瀏覽" 卡片：維持「依商品狀態／熱度」瀏覽入口的定位（不是合作鴿舍
  // 那套 CMS 分類系統），但每張卡片都改成對 listings 真實計算
  // 出來的子集合，並且連結帶對應的篩選 query，讓點進去的清單筆數跟卡片上
  // 的數字一致。
  const auctionListings = filterByListingType(listings, "auction");
  const fixedPriceOpenListings = filterByListingType(listings, "fixed_price");
  const quickCloseAuctions = selectQuickCloseAuctions(listings, nowMs);
  // 即將開賣：取代原本語意無法對應真實欄位的「限時精選」，改為真的還沒開賣
  // 的 scheduled 商品（原本的「高人氣商品推薦」在 schema 上跟「買家最愛」重
  // 複，故合理替換為狀態面向的另一個真實子集合）。
  const scheduledListings = allFetchedListings.filter((item) => item.status === "scheduled");
  const visualCategories: VisualCategoryItem[] = [
    {
      label: t("categoryAuction"),
      subtitle: t("promoAuctionTitle"),
      href: "/listings?type=auction",
      badge: "⚡",
      count: auctionListings.length,
    },
    {
      label: t("categoryFixedPrice"),
      subtitle: t("promoFixedTitle"),
      href: "/listings?type=fixed_price",
      badge: "🛍️",
      count: fixedPriceOpenListings.length,
    },
    {
      label: t("quickCloseLabel"),
      subtitle: t("quickCloseSubtitle", { hours: QUICK_CLOSE_WINDOW_HOURS }),
      href: `/listings?type=auction&sort=ends_soon&withinHours=${QUICK_CLOSE_WINDOW_HOURS}`,
      badge: "🎯",
      count: quickCloseAuctions.length,
    },
    {
      label: t("comingSoonLabel"),
      subtitle: t("comingSoonSubtitle"),
      href: "/listings?status=scheduled&sort=starts_soon",
      badge: "⏰",
      count: scheduledListings.length,
    },
  ];
  const homeEagerCount = EAGER_COUNTS[perfMode];
  const perfSuffix = perfMode === "aggressive" ? "&perf=aggressive" : "";

  /** Photo URL for a listing card, falling back to the site placeholder. */
  const photoUrlFor = (item: { id: number; photos: string[] }) =>
    item.photos[0] ? listingPhotoUrl(item.id, item.photos[0]) : IMAGE_FALLBACK_SRC;

  const toHeroCard = (item: (typeof listings)[number]) => ({
    id: item.id,
    href: `/listings/${item.id}`,
    title: item.title,
    photoUrl: photoUrlFor(item),
    hasPhoto: Boolean(item.photos[0]),
    currentPrice: item.current_price,
    buyItNowPrice: item.buy_it_now_price,
    endsAt: item.ends_at!.toISOString(),
    bidCount: item.bidCount,
  });
  const heroCards = endingSoonAuctions.map(toHeroCard);
  const topPriceHeroCards = topPriceAuctions.map(toHeroCard);

  return (
    <main className="pb-8">
      {/* Issue #148: reordered so the 最新消息／入賞鴿／進口鴿 showcase grid
          leads the page, directly above the hero auction rail. */}
      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <NewsCarouselCard
              items={newsCarouselItems}
              activeBadge={t("newsCarouselBadge")}
              ctaLabel={t("newsCarouselCta")}
              emptyStateTitle={t("emptyStateTitle")}
              emptyStateDesc={t("newsCarouselEmptyDesc")}
            />

            {/* 名家專區首頁輪播 (issue #176) — moved into this column, under
                最新消息 (issue #219), to backfill the height this column lost
                when the exchange-rate card moved out from beside it to below
                分類瀏覽 further down the page. Still always rendered (not
                gated on `.length > 0`), same "keep the layout slot occupied,
                show a neutral empty state instead of hiding the section"
                convention as NewsCarouselCard/PigeonShowcaseCarouselCard use;
                the component itself decides whether to render its empty
                state. */}
            <FeaturedLoftCarouselCard
              items={featuredLoftCarouselItems}
              activeBadge={t("featuredLoftsCarouselBadge")}
              ctaLabel={t("featuredLoftsCarouselCta")}
              viewMoreLabel={t("featuredLoftsCarouselViewMore")}
              viewMoreHref="/featured-lofts"
              emptyStateTitle={t("emptyStateTitle")}
              emptyStateDesc={t("featuredLoftsCarouselEmptyDesc")}
            />
          </div>

          <div className="grid gap-5">
            <PigeonShowcaseCarouselCard
              items={awardCarouselItems}
              variant="dark"
              badgeLabel={t("awardPigeonBadge")}
              emptyStateTitle={t("emptyStateTitle")}
              emptyStateDesc={t("pigeonShowcaseEmptyDesc")}
              viewCtaLabel={t("pigeonShowcaseViewCta")}
              viewMoreLabel={t("pigeonShowcaseViewMore")}
              viewMoreHref="/pigeon-showcase?category=award"
            />

            <PigeonShowcaseCarouselCard
              items={importedCarouselItems}
              variant="light"
              badgeLabel={t("importedPigeonBadge")}
              emptyStateTitle={t("emptyStateTitle")}
              emptyStateDesc={t("pigeonShowcaseEmptyDesc")}
              viewCtaLabel={t("pigeonShowcaseViewCta")}
              viewMoreLabel={t("pigeonShowcaseViewMore")}
              viewMoreHref="/pigeon-showcase?category=imported"
            />

            <PigeonShowcaseCarouselCard
              items={representativeCarouselItems}
              variant="accent"
              badgeLabel={t("representativePigeonBadge")}
              emptyStateTitle={t("emptyStateTitle")}
              emptyStateDesc={t("pigeonShowcaseEmptyDesc")}
              viewCtaLabel={t("pigeonShowcaseViewCta")}
              viewMoreLabel={t("pigeonShowcaseViewMore")}
              viewMoreHref="/pigeon-showcase?category=representative"
            />
          </div>
        </div>
      </section>

      <HeroSection
        browseHref={`/listings?type=auction${perfSuffix}`}
        cards={heroCards}
        topPriceCards={topPriceHeroCards}
        renderedAt={heroRenderedAt}
        currencyRates={currencyRates}
      />

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("newArrivals")}</h2>
          <Link href={perfMode === "aggressive" ? "/listings?perf=aggressive" : "/listings"} className="text-sm font-semibold text-interactive-primary hover:text-header">
            {t("viewAll")}
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <Link href="/listings" className="rounded-full bg-header px-3 py-1 font-semibold text-white">
            {t("pillAll")}
          </Link>
          <Link
            href="/listings?type=auction"
            className="rounded-full border border-border bg-white px-3 py-1 font-medium text-ink transition hover:border-interactive-primary hover:text-interactive-primary"
          >
            {t("pillHotAuction")}
          </Link>
          <Link
            href="/listings?type=fixed_price"
            className="rounded-full border border-border bg-white px-3 py-1 font-medium text-ink transition hover:border-interactive-primary hover:text-interactive-primary"
          >
            {t("pillFixedPicks")}
          </Link>
          <Link
            href="/listings?sort=price_desc"
            className="rounded-full border border-border bg-white px-3 py-1 font-medium text-ink transition hover:border-interactive-primary hover:text-interactive-primary"
          >
            {t("pillPriceDesc")}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newArrivals.map((item, index) => (
            <HomeProductCard
              key={item.id}
              id={item.id}
              title={item.title}
              imageSrc={photoUrlFor(item)}
              hasPhoto={Boolean(item.photos[0])}
              badgeLabel={item.listing_type === "auction" ? t("badgeHotBidding") : t("badgeBestPrice")}
              statusLabel={item.listing_type === "auction" ? t("statusBidding") : t("statusFixedDeal")}
              countLabel={
                item.listing_type === "auction"
                  ? t("bidCountShort", { count: item.bidCount })
                  : t("purchaseCountShort", { count: item.purchaseCount })
              }
              priceText={formatDualPrice(
                item.listing_type === "auction" ? item.current_price : item.price!,
                currencyRates,
              )}
              ctaLabel={item.listing_type === "fixed_price" ? t("promoFixedCta") : t("promoAuctionCta")}
              eager={index < homeEagerCount}
            />
          ))}
        </div>
      </section>

      {partnerLofts.length > 0 && (
        <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
          <div className="mb-1 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t("partnerLoftsTitle")}</h2>
            <Link href="/listings" className="text-sm font-semibold text-interactive-primary hover:text-header">
              {t("partnerLoftsViewAll")}
            </Link>
          </div>
          <p className="text-sm text-ink-light">{t("partnerLoftsSubtitle")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {partnerLofts.map((loft) => (
              // Clicking a loft card now goes to that loft's own listings
              // (issue #45 — link_url is gone; listings.loft_id is the new
              // FK used by the /listings?loft=<id> filter, see lib/listings.ts).
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

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("bestSellersTitle")}</h2>
          <Link href="/listings" className="text-sm font-semibold text-interactive-primary hover:text-header">
            {t("viewAll")}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bestMixed.map((item, index) => (
            <HomeProductCard
              key={`best-${item.id}`}
              id={item.id}
              title={item.title}
              imageSrc={photoUrlFor(item)}
              hasPhoto={Boolean(item.photos[0])}
              badgeLabel={item.listing_type === "auction" ? t("badgeHotBidding") : t("badgeBestPrice")}
              statusLabel={item.listing_type === "auction" ? t("statusBidding") : t("statusFixedDeal")}
              countLabel={
                item.listing_type === "auction"
                  ? t("bidCountShort", { count: item.bidCount })
                  : t("purchaseCountShort", { count: item.purchaseCount })
              }
              priceText={formatDualPrice(
                item.listing_type === "auction" ? item.current_price : item.price!,
                currencyRates,
              )}
              ctaLabel={item.listing_type === "fixed_price" ? t("promoFixedCta") : t("promoAuctionCta")}
              eager={index < 1}
            />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black">{t("bestAuction")}</h3>
            <div className="mt-3 space-y-2">
              {topAuctions.map((item) => (
                <Link key={item.id} href={`/listings/${item.id}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-ink-light">{item.bidCount === 0 ? tListings("noBidsYet") : tListings("totalBids", { count: item.bidCount })}</p>
                  </div>
                  <p className="ml-3 shrink-0 text-sm font-bold text-interactive-primary">{formatDualPrice(item.current_price, currencyRates)}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black">{t("bestFixed")}</h3>
            <div className="mt-3 space-y-2">
              {topFixed.map((item) => (
                <Link key={item.id} href={`/listings/${item.id}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-ink-light">{t("purchaseCountShort", { count: item.purchaseCount })}</p>
                  </div>
                  <p className="ml-3 shrink-0 text-sm font-bold text-interactive-primary">{formatDualPrice(item.price!, currencyRates)}</p>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">{t("dailyPicksEyebrow")}</p>
              <h3 className="mt-1 text-xl font-black text-ink">{t("dailyPicksTitle")}</h3>
            </div>
            <Link href="/listings" className="text-sm font-semibold text-interactive-primary hover:text-header">
              {t("viewAll")} →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {quickDeals.map((item, index) => (
              <HomeListingRow
                key={`deal-${item.id}`}
                id={item.id}
                title={item.title}
                imageSrc={photoUrlFor(item)}
                hasPhoto={Boolean(item.photos[0])}
                eager={index === 0}
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {item.listing_type === "auction" ? t("badgeHotBidding") : t("badgeBestPrice")}
                  </span>
                  <p className="truncate text-sm font-bold text-ink">{item.title}</p>
                </div>
                <p className="mt-1 text-xs text-ink-light">{item.listing_type === "auction" ? t("statusBidding") : t("statusFixedDeal")}</p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-base font-black text-ink">
                    {formatDualPrice(
                      item.listing_type === "auction" ? item.current_price : item.price!,
                      currencyRates,
                    )}
                  </p>
                  {/* M-15 (issue #139): this struck-through "original price" is
                      computed as current_price × 1.15, not read from any real
                      original-price column. Left exactly as-is — whether that
                      is intentional marketing is a product/legal call, not a
                      refactoring one. */}
                  {item.listing_type === "auction" && (
                    <p className="text-[11px] text-ink-light line-through">
                      {formatNtd(Math.ceil(Number(item.current_price) * 1.15))}
                    </p>
                  )}
                </div>
              </HomeListingRow>
            ))}
          </div>
        </div>
      </section>

      {fixedPriceListings.length > 0 && (
        <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">{t("fixedPriceSectionEyebrow")}</p>
                <h3 className="mt-1 text-xl font-black text-ink">{t("fixedPriceSectionTitle")}</h3>
              </div>
              <Link href="/listings?type=fixed_price" className="text-sm font-semibold text-interactive-primary hover:text-header">
                {t("fixedPriceSectionCta")} →
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {fixedPriceListings.map((item, index) => (
                <HomeListingRow
                  key={`fixed-price-${item.id}`}
                  id={item.id}
                  title={item.title}
                  imageSrc={photoUrlFor(item)}
                  hasPhoto={Boolean(item.photos[0])}
                  eager={index === 0}
                >
                  <p className="truncate text-sm font-bold text-ink">{item.title}</p>
                  <p className="mt-1 text-xs text-ink-light">
                    {item.stock_remaining != null
                      ? tListings("remainingUnits", { count: item.stock_remaining })
                      : t("fixedPriceSectionItemLabel")}
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-base font-black text-ink">{formatDualPrice(item.price!, currencyRates)}</p>
                  </div>
                </HomeListingRow>
              ))}
            </div>
          </div>
        </section>
      )}

      <SocialMediaSection items={socialItems} />

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold">{t("weatherTitle")}</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-bold text-ink">{t("weatherWindyLabel")}</p>
            </div>
            <iframe
              src="https://embed.windy.com/embed2.html?lat=23.380&lon=121.313&detailLat=23.380&detailLon=121.313&width=650&height=450&zoom=7&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1"
              title={t("weatherWindyLabel")}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[420px] w-full border-0 sm:h-[460px]"
            />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-bold text-ink">{t("weatherCwaLabel")}</p>
            </div>
            <iframe
              src="https://wifi.cwa.gov.tw/v2/"
              title={t("weatherCwaLabel")}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[420px] w-full border-0 sm:h-[460px]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-baltic-blue-900 to-slate-900 p-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-steel-azure-200">{t("trustEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-black">{t("trustTitle")}</h2>
          <p className="mt-4 max-w-3xl text-sm text-steel-azure-100">
            {t("trustDesc")}
          </p>

          <Link href="/listings" className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-steel-azure-800 transition hover:bg-steel-azure-50">
            {t("trustCta")}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="rounded-full bg-header px-3 py-1 font-semibold text-white">{t("quickNavTitle")}</span>
            <Link href="/listings?type=auction" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-interactive-primary hover:text-interactive-primary">
              {t("quickNavEndingSoon")}
            </Link>
            <Link href="/#auto-bidding-explainer" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-interactive-primary hover:text-interactive-primary">
              {t("quickNavAutoBidGuide")}
            </Link>
            <Link href="/listings?sort=price_desc" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-interactive-primary hover:text-interactive-primary">
              {t("quickNavPremiumPicks")}
            </Link>
          </div>
        </div>
      </section>

      <section id="auto-bidding-explainer" className="mx-auto mt-5 max-w-6xl scroll-mt-24 px-4 sm:px-6">
        <div className="rounded-2xl border border-interactive-primary/20 bg-interactive-primary-subtle p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-black text-ink">{tAutoBid("title")}</h2>
          <p className="mt-1 text-sm text-ink-light">{tAutoBid("description")}</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            <li className="rounded-xl bg-white/70 p-3 text-sm text-ink">
              <span className="mb-1 block text-xs font-bold text-interactive-primary">1</span>
              {tAutoBid("step1")}
            </li>
            <li className="rounded-xl bg-white/70 p-3 text-sm text-ink">
              <span className="mb-1 block text-xs font-bold text-interactive-primary">2</span>
              {tAutoBid("step2")}
            </li>
            <li className="rounded-xl bg-white/70 p-3 text-sm text-ink">
              <span className="mb-1 block text-xs font-bold text-interactive-primary">3</span>
              {tAutoBid("step3")}
            </li>
          </ol>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-white shadow-sm md:grid-cols-2 lg:grid-cols-4">
          <article className="flex items-center gap-3 border-b border-border px-5 py-4 md:border-r lg:border-b-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-steel-azure-50 text-lg">🚚</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceFast")}</p>
              <p className="text-xs text-ink-light">{t("serviceFastDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 border-b border-border px-5 py-4 lg:border-b-0 lg:border-r">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-steel-azure-50 text-lg">🔒</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceSecure")}</p>
              <p className="text-xs text-ink-light">{t("serviceSecureDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 border-b border-border px-5 py-4 md:border-b-0 md:border-r">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-steel-azure-50 text-lg">🎧</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceSupport")}</p>
              <p className="text-xs text-ink-light">{t("serviceSupportDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 px-5 py-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-steel-azure-50 text-lg">✅</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceVerified")}</p>
              <p className="text-xs text-ink-light">{t("serviceVerifiedDesc")}</p>
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("browseByCategory")}</h2>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visualCategories.map((cat) => (
            <Link
              key={`${cat.label}-${cat.href}`}
              href={cat.href}
              className="group rounded-2xl border border-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-interactive-primary">{cat.label}</p>
                  <p className="mt-2 text-sm text-ink-light">{cat.subtitle}</p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">{cat.badge}</span>
              </div>
              <p className="mt-4 text-2xl font-black text-ink">{cat.count}</p>
              <p className="mt-1 text-sm font-semibold text-interactive-primary group-hover:text-header">{t("viewAll")} →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <ExchangeRateStrip />
      </section>

    </main>
  );
}
