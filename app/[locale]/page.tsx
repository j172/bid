import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { listOpenListings } from "@/lib/listings";
import { listingPhotoUrl, homepageSectionImageUrl, pigeonGalleryCategoryImageUrl } from "@/lib/uploads";
import { listHomepageSections } from "@/lib/homepageSections";
import { listPigeonGalleryCategories, type GalleryType, type PigeonGalleryCategory } from "@/lib/pigeonGallery";
import { Link } from "@/i18n/navigation";
import HeroSection from "./components/HeroSection";
import ZoomableProductImage from "./components/ZoomableProductImage";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type CategoryItem = { key: "auction" | "fixed_price"; count: number };

type VisualCategoryItem = {
  label: string;
  subtitle: string;
  href: string;
  badge: string;
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
  const tGallery = await getTranslations("pigeonGallery");
  const [awardCategories, importCategories] = await Promise.all([
    listPigeonGalleryCategories("award", { activeOnly: true }),
    listPigeonGalleryCategories("import", { activeOnly: true }),
  ]);
  // listOpenListings now also returns 'scheduled' (not-yet-started) auctions
  // for the /listings browse page's benefit — the homepage's curated
  // sections below (ending soon, quick deals, etc.) all assume "actively
  // biddable" semantics (bid counts, "剩餘 X" urgency framing), so they stay
  // open-only rather than growing their own scheduled-aware treatment.
  const listings = (await listOpenListings()).filter((item) => item.status === "open");
  const partnerLofts = await listHomepageSections("partner_loft", { activeOnly: true });

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
  const categoryItems: CategoryItem[] = [
    { key: "auction", count: listings.filter((item) => item.listing_type === "auction").length },
    { key: "fixed_price", count: listings.filter((item) => item.listing_type === "fixed_price").length },
  ];
  const visualCategories: VisualCategoryItem[] = [
    {
      label: t("categoryAuction"),
      subtitle: t("promoAuctionTitle"),
      href: "/listings?type=auction",
      badge: "⚡",
    },
    {
      label: t("categoryFixedPrice"),
      subtitle: t("promoFixedTitle"),
      href: "/listings?type=fixed_price",
      badge: "🛍️",
    },
    {
      label: "快速結標",
      subtitle: "支援一鍵買斷",
      href: "/listings?type=auction",
      badge: "🎯",
    },
    {
      label: "限時精選",
      subtitle: "高人氣商品推薦",
      href: "/listings",
      badge: "🔥",
    },
    {
      label: "買家最愛",
      subtitle: "固定價熱門排行",
      href: "/listings?type=fixed_price",
      badge: "❤️",
    },
    {
      label: "新手友善",
      subtitle: "從低價商品開始",
      href: "/listings",
      badge: "🌟",
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
            <span className="rounded-full bg-header px-3 py-1 font-semibold text-white">熱門入口</span>
            <Link href="/listings?type=auction" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-interactive-primary hover:text-interactive-primary">
              🔥 即將結標
            </Link>
            <Link href="/listings?type=fixed_price&maxPrice=1000" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-interactive-primary hover:text-interactive-primary">
              💡 千元好物
            </Link>
            <Link href="/listings?q=proxy" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-interactive-primary hover:text-interactive-primary">
              ⚙️ 代理出價
            </Link>
            <Link href="/listings?sort=price_desc" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-interactive-primary hover:text-interactive-primary">
              💎 高單價精選
            </Link>
          </div>
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
              <p className="text-sm font-bold text-ink">100% 嚴格驗證</p>
              <p className="text-xs text-ink-light">所有價格與庫存皆伺服器檢核</p>
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("browseByCategory")}</h2>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visualCategories.map((cat) => {
            const count =
              cat.href.includes("type=auction")
                ? categoryItems.find((item) => item.key === "auction")?.count
                : cat.href.includes("type=fixed_price")
                  ? categoryItems.find((item) => item.key === "fixed_price")?.count
                  : listings.length;
            return (
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
                <p className="mt-4 text-2xl font-black text-ink">{count}</p>
                <p className="mt-1 text-sm font-semibold text-interactive-primary group-hover:text-header">{t("viewAll")} →</p>
              </Link>
            );
          })}
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
            {partnerLofts.map((loft) => {
              const isInternal = loft.linkUrl.startsWith("/");
              const cardContent = (
                <>
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
                </>
              );
              const cardClassName =
                "group overflow-hidden rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";
              return isInternal ? (
                <Link key={loft.id} href={loft.linkUrl} className={cardClassName}>
                  {cardContent}
                </Link>
              ) : (
                <a key={loft.id} href={loft.linkUrl} target="_blank" rel="noopener noreferrer" className={cardClassName}>
                  {cardContent}
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-600">Daily Deals</p>
              <h3 className="mt-1 text-xl font-black text-ink">今日精選快閃優惠</h3>
            </div>
            <Link href="/listings" className="text-sm font-semibold text-interactive-primary hover:text-header">
              Shop all deals →
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
                  <span className="absolute left-1 top-1 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">HOT</span>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{item.title}</p>
                  <p className="mt-1 text-xs text-ink-light">{item.listing_type === "auction" ? "競標中" : "固定價優惠"}</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-base font-black text-ink">{item.listing_type === "auction" ? item.current_price : item.price}</p>
                    <p className="text-[11px] text-ink-light line-through">
                      {Math.ceil(Number(item.listing_type === "auction" ? item.current_price : item.price) * 1.15)}
                    </p>
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

      {[
        { galleryType: "award" as GalleryType, categories: awardCategories, title: tGallery("sectionAwardTitle"), subtitle: tGallery("sectionAwardSubtitle") },
        { galleryType: "import" as GalleryType, categories: importCategories, title: tGallery("sectionImportTitle"), subtitle: tGallery("sectionImportSubtitle") },
      ].map(
        (group) =>
          group.categories.length > 0 && (
            <section key={group.galleryType} className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-interactive-primary">{group.subtitle}</p>
                    <h3 className="mt-1 text-xl font-black text-ink">{group.title}</h3>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.categories.map((category: PigeonGalleryCategory) => (
                    <Link
                      key={category.id}
                      href={`/pigeons/${group.galleryType}/${category.id}`}
                      className="group overflow-hidden rounded-xl border border-border bg-slate-50 transition hover:-translate-y-0.5 hover:border-interactive-primary hover:shadow-md"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                        <img
                          src={pigeonGalleryCategoryImageUrl(category.coverImageFileName)}
                          alt={category.name}
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                      <p className="px-3 py-2 text-center text-sm font-extrabold tracking-wide text-ink group-hover:text-interactive-primary">
                        {category.name}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ),
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
            全部商品
          </Link>
          <Link
            href="/listings?type=auction"
            className="rounded-full border border-border bg-white px-3 py-1 font-medium text-ink transition hover:border-interactive-primary hover:text-interactive-primary"
          >
            熱門競標
          </Link>
          <Link
            href="/listings?type=fixed_price"
            className="rounded-full border border-border bg-white px-3 py-1 font-medium text-ink transition hover:border-interactive-primary hover:text-interactive-primary"
          >
            固定價精選
          </Link>
          <Link
            href="/listings?sort=price_desc"
            className="rounded-full border border-border bg-white px-3 py-1 font-medium text-ink transition hover:border-interactive-primary hover:text-interactive-primary"
          >
            高單價趨勢
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
                  <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-interactive-primary shadow-sm">
                    {item.listing_type === "auction" ? "HOT BIDDING" : "BEST PRICE"}
                  </span>
                </div>
              </Link>
              <h3 className="mt-3 truncate text-sm font-semibold text-ink">{item.title}</h3>
              <div className="mt-1 flex items-center justify-between text-[11px] text-ink-light">
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-500">●</span>
                  <span>{item.listing_type === "auction" ? "競標中" : "一般商品"}</span>
                </span>
                <span>{item.listing_type === "auction" ? `已出價 ${item.bidCount}` : `已售 ${item.purchaseCount}`}</span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-lg font-black text-ink">{item.listing_type === "auction" ? item.current_price : item.price}</p>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-ink">Quick View</span>
                <Link href={`/listings/${item.id}`} className="rounded-md bg-header px-2 py-1 font-semibold text-white">
                  {item.listing_type === "fixed_price" ? "Add To Cart" : "Place Bid"}
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
            <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Auction Focus</span>
            <p className="text-xs font-bold uppercase tracking-wider">{t("promoAuctionBadge")}</p>
            <h3 className="mt-2 text-3xl font-black">{t("promoAuctionTitle")}</h3>
            <p className="mt-3 max-w-xl text-sm text-muted-olive-100">{t("promoAuctionDesc")}</p>
            <Link href={`/listings?type=auction${perfSuffix}`} className="mt-5 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-muted-olive-700">
              {t("promoAuctionCta")}
            </Link>
          </div>

          <div className="grid gap-5">
            <div className="rounded-2xl bg-gradient-to-r from-muted-olive-700 to-slate-900 p-6 text-white">
              <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Limited Offer</span>
              <p className="text-xs font-bold uppercase tracking-wider">{t("promoFixedBadge")}</p>
              <h3 className="mt-2 text-2xl font-black">{t("promoFixedTitle")}</h3>
              <p className="mt-3 text-sm text-muted-olive-100">{t("promoFixedDesc")}</p>
              <Link href={`/listings?type=fixed_price${perfSuffix}`} className="mt-4 inline-flex rounded-md bg-white px-3 py-1.5 text-xs font-bold text-muted-olive-700">
                {t("promoFixedCta")}
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-interactive-primary">Weekly Picks</p>
              <h3 className="mt-2 text-xl font-black text-ink">搶手商品週末限時折扣</h3>
              <p className="mt-2 text-sm text-ink-light">從競標標的到固定價商品，這週精選一次看完。</p>
              <Link href="/listings" className="mt-4 inline-flex rounded-md bg-header px-3 py-1.5 text-xs font-bold text-white">
                立即查看
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">Best Sellers</h2>
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
                  <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-interactive-primary shadow-sm">
                    {item.listing_type === "auction" ? "HOT BIDDING" : "BEST PRICE"}
                  </span>
                </div>
              </Link>

              <h3 className="mt-3 truncate text-sm font-semibold text-ink">{item.title}</h3>
              <div className="mt-1 flex items-center justify-between text-[11px] text-ink-light">
                <span className="inline-flex items-center gap-1">
                  <span className="text-amber-500">●</span>
                  <span>{item.listing_type === "auction" ? "競標中" : "一般商品"}</span>
                </span>
                <span>{item.listing_type === "auction" ? `已出價 ${item.bidCount}` : `已售 ${item.purchaseCount}`}</span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-lg font-black text-ink">{item.listing_type === "auction" ? item.current_price : item.price}</p>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-ink">Quick View</span>
                <Link href={`/listings/${item.id}`} className="rounded-md bg-header px-2 py-1 font-semibold text-white">
                  {item.listing_type === "fixed_price" ? "Add To Cart" : "Place Bid"}
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
                    <p className="text-xs text-ink-light">已售 {item.purchaseCount}</p>
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-olive-200">Enhance your bidding experience</p>
          <h2 className="mt-2 text-3xl font-black">依真實資料掌握熱門商品</h2>
          <p className="mt-4 max-w-3xl text-sm text-muted-olive-100">
            首頁所有熱門卡片、出價次數與已售件數皆直接來自目前商品資料，不再用寫死數字假裝即時行情。
          </p>

          <Link href="/listings" className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-bold text-muted-olive-800 transition hover:bg-muted-olive-50">
            查看全部商品
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
