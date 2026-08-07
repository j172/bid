import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { listOpenListings } from "@/lib/listings";
import { listingPhotoUrl, homepageSectionImageUrl } from "@/lib/uploads";
import { listHomepageSections } from "@/lib/homepageSections";
import { listLatestPigeonShowcase } from "@/lib/pigeonShowcase";
import { excerptHtml } from "@/lib/htmlText";
import { Link } from "@/i18n/navigation";
import HeroSection from "./components/HeroSection";
import ZoomableProductImage from "./components/ZoomableProductImage";
import PigeonShowcaseCarouselCard from "./components/PigeonShowcaseCarouselCard";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type VisualCategoryItem = {
  label: string;
  subtitle: string;
  href: string;
  badge: string;
  count: number;
};

function perfModeFromSearchParams(params: SearchParams): "balanced" | "aggressive" {
  const modeParam = params.perf;
  const mode = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  return mode === "aggressive" ? "aggressive" : "balanced";
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
  const allFetchedListings = await listOpenListings();
  const listings = allFetchedListings.filter((item) => item.status === "open");
  const partnerLofts = await listHomepageSections("partner_loft", { activeOnly: true });
  // 入賞鴿／進口鴿首頁輪播 (issue #54) — latest 10 per category, feeding the
  // two small promo cards below (replacing their static marketing copy when
  // non-empty; see PigeonShowcaseCarouselCard's own fallback branch).
  const PIGEON_CAROUSEL_EXCERPT_LENGTH = 60;
  const [awardPigeons, importedPigeons] = await Promise.all([
    listLatestPigeonShowcase("award", 10),
    listLatestPigeonShowcase("imported", 10),
  ]);
  const awardCarouselItems = awardPigeons.map((pigeon) => ({
    id: pigeon.id,
    name: pigeon.name,
    excerpt: excerptHtml(pigeon.description, PIGEON_CAROUSEL_EXCERPT_LENGTH),
  }));
  const importedCarouselItems = importedPigeons.map((pigeon) => ({
    id: pigeon.id,
    name: pigeon.name,
    excerpt: excerptHtml(pigeon.description, PIGEON_CAROUSEL_EXCERPT_LENGTH),
  }));

  const heroRenderedAt = new Date().toISOString();
  const auctionsByEndingSoon = [...listings]
    .filter((item) => item.listing_type === "auction" && item.ends_at)
    .sort((a, b) => a.ends_at!.getTime() - b.ends_at!.getTime() || b.current_price - a.current_price);
  const endingSoonWithPhoto = auctionsByEndingSoon.filter((item) => Boolean(item.photos[0]));
  const endingSoonWithoutPhoto = auctionsByEndingSoon.filter((item) => !item.photos[0]);
  const endingSoonAuctions = [...endingSoonWithPhoto, ...endingSoonWithoutPhoto].slice(0, 5);
  const topPriceAuctions = [...listings]
    .filter((item) => item.listing_type === "auction" && item.ends_at)
    .sort((a, b) => b.current_price - a.current_price || a.ends_at!.getTime() - b.ends_at!.getTime())
    .slice(0, 2);
  const quickDeals = listings.slice(0, 3);
  const newArrivals = listings.slice(0, 8);
  const bestMixed = [...listings]
    .sort(
      (a, b) =>
        (b.bidCount + b.purchaseCount) - (a.bidCount + a.purchaseCount) ||
        (b.listing_type === "auction" ? b.current_price : (b.price ?? 0)) -
          (a.listing_type === "auction" ? a.current_price : (a.price ?? 0)),
    )
    .slice(0, 6);
  const topAuctions = [...listings]
    .filter((item) => item.listing_type === "auction")
    .sort((a, b) => b.bidCount - a.bidCount || b.current_price - a.current_price)
    .slice(0, 4);
  const topFixed = [...listings]
    .filter((item) => item.listing_type === "fixed_price")
    .sort((a, b) => b.purchaseCount - a.purchaseCount || (b.price ?? 0) - (a.price ?? 0))
    .slice(0, 4);
  // Independent "定價種鴿" homepage section (issue #36) — real fixed_price,
  // status='open' listings straight from the same fetch every other section
  // on this page already uses, newest-first so recently listed pigeons
  // surface first. Renders nothing when there are none (see JSX below).
  const fixedPriceListings = [...listings]
    .filter((item) => item.listing_type === "fixed_price")
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 6);
  // "分類瀏覽" 卡片：維持「依商品狀態／熱度」瀏覽入口的定位（不是合作鴿舍
  // 那套 CMS 分類系統），但每張卡片都改成對 listings 真實計算
  // 出來的子集合，並且連結帶對應的篩選 query，讓點進去的清單筆數跟卡片上
  // 的數字一致。
  const QUICK_CLOSE_WINDOW_HOURS = 72;
  const quickCloseWindowMs = QUICK_CLOSE_WINDOW_HOURS * 60 * 60 * 1000;
  const now = new Date().getTime();
  const auctionListings = listings.filter((item) => item.listing_type === "auction");
  const fixedPriceOpenListings = listings.filter((item) => item.listing_type === "fixed_price");
  // 快速結標：open 狀態的競標商品中，3 天內即將截止的（而非全部競標商品，
  // 否則會跟「拍賣商品」卡片數字重複）。
  const quickCloseAuctions = auctionListings.filter((item) => {
    if (!item.ends_at) return false;
    const remaining = item.ends_at.getTime() - now;
    return remaining >= 0 && remaining <= quickCloseWindowMs;
  });
  // 即將開賣：取代原本語意無法對應真實欄位的「限時精選」，改為真的還沒開賣
  // 的 scheduled 商品（原本的「高人氣商品推薦」在 schema 上跟「買家最愛」重
  // 複，故合理替換為狀態面向的另一個真實子集合）。
  const scheduledListings = allFetchedListings.filter((item) => item.status === "scheduled");
  // 買家最愛：依出價次數（競標）+ 購買次數（固定價）加總排序取熱門商品，
  // 只計入有實際出價／購買紀錄的商品，避免跟「全部商品」的數字重複。
  const popularListings = listings.filter((item) => item.bidCount + item.purchaseCount > 0);
  // 新手友善：原本語意（低價入門）在現有 schema 下可直接用真實價格欄位計算，
  // 取兩種商品類型皆適用的現價 <= 門檻。
  const BEGINNER_MAX_PRICE = 1000;
  const beginnerListings = listings.filter((item) => {
    const price = item.listing_type === "auction" ? item.current_price : (item.price ?? item.current_price);
    return price <= BEGINNER_MAX_PRICE;
  });
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
    {
      label: t("popularLabel"),
      subtitle: t("popularSubtitle"),
      href: "/listings?sort=popular",
      badge: "❤️",
      count: popularListings.length,
    },
    {
      label: t("beginnerLabel"),
      subtitle: t("beginnerSubtitle", { price: BEGINNER_MAX_PRICE }),
      href: `/listings?maxPrice=${BEGINNER_MAX_PRICE}`,
      badge: "🌟",
      count: beginnerListings.length,
    },
  ];
  const homeEagerCount = perfMode === "aggressive" ? 2 : 1;
  const perfSuffix = perfMode === "aggressive" ? "&perf=aggressive" : "";
  const heroCards = endingSoonAuctions.map((item) => ({
    id: item.id,
    href: `/listings/${item.id}`,
    title: item.title,
    photoUrl: item.photos[0] ? listingPhotoUrl(item.id, item.photos[0]) : "/images/hero-placeholder.png",
    hasPhoto: Boolean(item.photos[0]),
    currentPrice: item.current_price,
    buyItNowPrice: item.buy_it_now_price,
    endsAt: item.ends_at!.toISOString(),
    bidCount: item.bidCount,
  }));
  const topPriceHeroCards = topPriceAuctions.map((item) => ({
    id: item.id,
    href: `/listings/${item.id}`,
    title: item.title,
    photoUrl: item.photos[0] ? listingPhotoUrl(item.id, item.photos[0]) : "/images/hero-placeholder.png",
    hasPhoto: Boolean(item.photos[0]),
    currentPrice: item.current_price,
    buyItNowPrice: item.buy_it_now_price,
    endsAt: item.ends_at!.toISOString(),
    bidCount: item.bidCount,
  }));

  return (
    <main className="pb-8">
      <HeroSection
        browseHref={`/listings?type=auction${perfSuffix}`}
        cards={heroCards}
        topPriceCards={topPriceHeroCards}
        renderedAt={heroRenderedAt}
      />

      <section className="mx-auto mt-5 max-w-6xl px-4 sm:px-6">
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
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted-olive-50 text-lg">🚚</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceFast")}</p>
              <p className="text-xs text-ink-light">{t("serviceFastDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 border-b border-border px-5 py-4 lg:border-b-0 lg:border-r">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted-olive-50 text-lg">🔒</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceSecure")}</p>
              <p className="text-xs text-ink-light">{t("serviceSecureDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 border-b border-border px-5 py-4 md:border-b-0 md:border-r">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted-olive-50 text-lg">🎧</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceSupport")}</p>
              <p className="text-xs text-ink-light">{t("serviceSupportDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 px-5 py-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted-olive-50 text-lg">✅</span>
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
                  <Image
                    src={homepageSectionImageUrl(loft.imageFileName)}
                    alt={loft.title}
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition group-hover:scale-105"
                  />
                </div>
                <p className="mt-3 text-sm font-bold text-ink">{loft.title}</p>
                {loft.bio && <p className="mt-1 line-clamp-2 text-xs text-ink-light">{loft.bio}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
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
              (() => {
                const hasPhoto = Boolean(item.photos[0]);
                return (
              <Link
                key={`deal-${item.id}`}
                href={`/listings/${item.id}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-slate-50 p-3 transition hover:-translate-y-0.5 hover:border-interactive-primary/50 hover:bg-white"
              >
                <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg ${hasPhoto ? "bg-slate-100" : "bg-white/90"}`}>
                  <ZoomableProductImage
                    src={item.photos[0] ? listingPhotoUrl(item.id, item.photos[0]) : "/images/hero-placeholder.png"}
                    alt={item.title}
                    eager={index === 0}
                    fetchPriority={index === 0 ? "high" : "auto"}
                    sizes="80px"
                    zoomPreset="medium"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {item.listing_type === "auction" ? t("badgeHotBidding") : t("badgeBestPrice")}
                    </span>
                    <p className="truncate text-sm font-bold text-ink">{item.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-ink-light">{item.listing_type === "auction" ? t("statusBidding") : t("statusFixedDeal")}</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-base font-black text-ink">{item.listing_type === "auction" ? item.current_price : item.price}</p>
                    {item.listing_type === "auction" && (
                      <p className="text-[11px] text-ink-light line-through">
                        {Math.ceil(Number(item.current_price) * 1.15)}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
                );
              })()
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
              {fixedPriceListings.map((item, index) => {
                const hasPhoto = Boolean(item.photos[0]);
                return (
                  <Link
                    key={`fixed-price-${item.id}`}
                    href={`/listings/${item.id}`}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-slate-50 p-3 transition hover:-translate-y-0.5 hover:border-interactive-primary/50 hover:bg-white"
                  >
                    <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg ${hasPhoto ? "bg-slate-100" : "bg-white/90"}`}>
                      <ZoomableProductImage
                        src={item.photos[0] ? listingPhotoUrl(item.id, item.photos[0]) : "/images/hero-placeholder.png"}
                        alt={item.title}
                        eager={index === 0}
                        fetchPriority={index === 0 ? "high" : "auto"}
                        sizes="80px"
                        zoomPreset="medium"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{item.title}</p>
                      <p className="mt-1 text-xs text-ink-light">
                        {item.stock_remaining != null
                          ? tListings("remainingUnits", { count: item.stock_remaining })
                          : t("fixedPriceSectionItemLabel")}
                      </p>
                      <div className="mt-2 flex items-end gap-2">
                        <p className="text-base font-black text-ink">{item.price}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

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
            (() => {
              const hasPhoto = Boolean(item.photos[0]);
              return (
            <article
              key={item.id}
              className="group rounded-2xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-interactive-primary/60 hover:shadow-md"
            >
              <Link href={`/listings/${item.id}`} className="block">
                <div className="mb-2">
                  <span className="inline-flex rounded-md bg-interactive-primary-subtle px-2 py-1 text-[11px] font-bold text-interactive-primary">
                    {item.listing_type === "auction" ? t("badgeHotBidding") : t("badgeBestPrice")}
                  </span>
                </div>
                <div className={`relative aspect-[4/3] overflow-hidden rounded-xl ${hasPhoto ? "bg-slate-100" : "bg-white/90"}`}>
                  <ZoomableProductImage
                    src={item.photos[0] ? listingPhotoUrl(item.id, item.photos[0]) : "/images/hero-placeholder.png"}
                    alt={item.title}
                    eager={index < homeEagerCount}
                    fetchPriority={index < homeEagerCount ? "high" : "auto"}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    zoomPreset="medium"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
                </div>
              </Link>
              <h3 className="mt-3 truncate text-sm font-semibold text-ink">{item.title}</h3>
              <div className="mt-1 flex items-center justify-between text-[11px] text-ink-light">
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-500">●</span>
                  <span>{item.listing_type === "auction" ? t("statusBidding") : t("statusFixedDeal")}</span>
                </span>
                <span>
                  {item.listing_type === "auction"
                    ? t("bidCountShort", { count: item.bidCount })
                    : t("purchaseCountShort", { count: item.purchaseCount })}
                </span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-lg font-black text-ink">{item.listing_type === "auction" ? item.current_price : item.price}</p>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-ink">{tListings("quickAction")}</span>
                <Link href={`/listings/${item.id}`} className="rounded-md bg-header px-2 py-1 font-semibold text-white">
                  {item.listing_type === "fixed_price" ? t("promoFixedCta") : t("promoAuctionCta")}
                </Link>
              </div>
            </article>
              );
            })()
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-r from-muted-olive-500 to-muted-olive-600 p-7 text-white lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider">{t("promoAuctionBadge")}</p>
            <h3 className="mt-2 text-3xl font-black">{t("promoAuctionTitle")}</h3>
            <p className="mt-3 max-w-xl text-sm text-muted-olive-100">{t("promoAuctionDesc")}</p>
            <Link href={`/listings?type=auction${perfSuffix}`} className="mt-5 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-muted-olive-700">
              {t("promoAuctionCta")}
            </Link>
          </div>

          <div className="grid gap-5">
            <PigeonShowcaseCarouselCard
              items={awardCarouselItems}
              variant="dark"
              badgeLabel={t("promoFixedBadge")}
              fallbackTitle={t("promoFixedTitle")}
              fallbackDesc={t("promoFixedDesc")}
              fallbackCtaLabel={t("promoFixedCta")}
              fallbackCtaHref={`/listings?type=fixed_price${perfSuffix}`}
              viewCtaLabel={t("pigeonShowcaseViewCta")}
              viewMoreLabel={t("pigeonShowcaseViewMore")}
              viewMoreHref="/pigeon-showcase?category=award"
            />

            <PigeonShowcaseCarouselCard
              items={importedCarouselItems}
              variant="light"
              badgeLabel={t("weeklyPicksEyebrow")}
              fallbackTitle={t("weeklyPicksTitle")}
              fallbackDesc={t("weeklyPicksDesc")}
              fallbackCtaLabel={t("viewAll")}
              fallbackCtaHref="/listings"
              viewCtaLabel={t("pigeonShowcaseViewCta")}
              viewMoreLabel={t("pigeonShowcaseViewMore")}
              viewMoreHref="/pigeon-showcase?category=imported"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("bestSellersTitle")}</h2>
          <Link href="/listings" className="text-sm font-semibold text-interactive-primary hover:text-header">
            {t("viewAll")}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bestMixed.map((item, index) => (
            (() => {
              const hasPhoto = Boolean(item.photos[0]);
              return (
            <article key={`best-${item.id}`} className="group rounded-2xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-interactive-primary/60 hover:shadow-md">
              <Link href={`/listings/${item.id}`} className="block">
                <div className="mb-2">
                  <span className="inline-flex rounded-md bg-interactive-primary-subtle px-2 py-1 text-[11px] font-bold text-interactive-primary">
                    {item.listing_type === "auction" ? t("badgeHotBidding") : t("badgeBestPrice")}
                  </span>
                </div>
                <div className={`relative aspect-[4/3] overflow-hidden rounded-xl ${hasPhoto ? "bg-slate-100" : "bg-white/90"}`}>
                  <ZoomableProductImage
                    src={item.photos[0] ? listingPhotoUrl(item.id, item.photos[0]) : "/images/hero-placeholder.png"}
                    alt={item.title}
                    eager={index < 1}
                    fetchPriority={index < 1 ? "high" : "auto"}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    zoomPreset="medium"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
                </div>
              </Link>

              <h3 className="mt-3 truncate text-sm font-semibold text-ink">{item.title}</h3>
              <div className="mt-1 flex items-center justify-between text-[11px] text-ink-light">
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-500">●</span>
                  <span>{item.listing_type === "auction" ? t("statusBidding") : t("statusFixedDeal")}</span>
                </span>
                <span>
                  {item.listing_type === "auction"
                    ? t("bidCountShort", { count: item.bidCount })
                    : t("purchaseCountShort", { count: item.purchaseCount })}
                </span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-lg font-black text-ink">{item.listing_type === "auction" ? item.current_price : item.price}</p>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-ink">{tListings("quickAction")}</span>
                <Link href={`/listings/${item.id}`} className="rounded-md bg-header px-2 py-1 font-semibold text-white">
                  {item.listing_type === "fixed_price" ? t("promoFixedCta") : t("promoAuctionCta")}
                </Link>
              </div>
            </article>
              );
            })()
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
                  <p className="ml-3 shrink-0 text-sm font-bold text-interactive-primary">{item.current_price}</p>
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
                  <p className="ml-3 shrink-0 text-sm font-bold text-interactive-primary">{item.price}</p>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-muted-olive-900 to-slate-900 p-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-olive-200">{t("trustEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-black">{t("trustTitle")}</h2>
          <p className="mt-4 max-w-3xl text-sm text-muted-olive-100">
            {t("trustDesc")}
          </p>

          <Link href="/listings" className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-muted-olive-800 transition hover:bg-muted-olive-50">
            {t("trustCta")}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

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

    </main>
  );
}
