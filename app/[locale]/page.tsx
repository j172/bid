import { getTranslations } from "next-intl/server";
import { listOpenListings } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { formatRemaining } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import ProgressiveImage from "@/app/components/ProgressiveImage";
import HeroSection from "./components/HeroSection";

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
  const tFormat = await getTranslations("format");
  const listings = await listOpenListings();

  const featured = listings.slice(0, 3);
  const newArrivals = listings.slice(0, 8);
  const bestMixed = listings.slice(0, 6);
  const topAuctions = listings.filter((item) => item.listing_type === "auction").slice(0, 4);
  const topFixed = listings.filter((item) => item.listing_type === "fixed_price").slice(0, 4);
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
  const feedbacks = [
    { quote: t("feedbackQuoteOne"), role: t("feedbackRoleOne") },
    { quote: t("feedbackQuoteTwo"), role: t("feedbackRoleTwo") },
  ];
  const homeEagerCount = perfMode === "aggressive" ? 2 : 1;
  const perfSuffix = perfMode === "aggressive" ? "&perf=aggressive" : "";
  const heroCards = featured.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle:
      item.listing_type === "auction"
        ? tListings("buyItNowPrice", { price: item.buy_it_now_price ?? item.current_price })
        : tListings("remainingUnits", { count: item.stock_remaining ?? 0 }),
    photo: item.photos[0],
  }));

  return (
    <main className="pb-8">
      <HeroSection
        badge={t("heroBadge")}
        title={t("title")}
        subtitle={t("subtitle")}
        browseLabel={t("browseButton")}
        auctionLabel={t("auctionCta")}
        browseHref={perfMode === "aggressive" ? "/listings?perf=aggressive" : "/listings"}
        auctionHref={`/listings?type=auction${perfSuffix}`}
        cards={heroCards}
      />

      <section className="mx-auto mt-5 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-border bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="rounded-full bg-header px-3 py-1 font-semibold text-white">熱門入口</span>
            <Link href="/listings?type=auction" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-brand-blue hover:text-brand-blue">
              🔥 即將結標
            </Link>
            <Link href="/listings?type=fixed_price&maxPrice=1000" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-brand-blue hover:text-brand-blue">
              💡 千元好物
            </Link>
            <Link href="/listings?q=proxy" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-brand-blue hover:text-brand-blue">
              ⚙️ 代理出價
            </Link>
            <Link href="/listings?sort=price_desc" className="rounded-full border border-border bg-slate-50 px-3 py-1 font-medium text-ink hover:border-brand-blue hover:text-brand-blue">
              💎 高單價精選
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-white shadow-sm md:grid-cols-2 lg:grid-cols-4">
          <article className="flex items-center gap-3 border-b border-border px-5 py-4 md:border-r lg:border-b-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-lg">🚚</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceFast")}</p>
              <p className="text-xs text-ink-light">{t("serviceFastDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 border-b border-border px-5 py-4 lg:border-b-0 lg:border-r">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-lg">🔒</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceSecure")}</p>
              <p className="text-xs text-ink-light">{t("serviceSecureDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 border-b border-border px-5 py-4 md:border-b-0 md:border-r">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-lg">🎧</span>
            <div>
              <p className="text-sm font-bold text-ink">{t("serviceSupport")}</p>
              <p className="text-xs text-ink-light">{t("serviceSupportDesc")}</p>
            </div>
          </article>
          <article className="flex items-center gap-3 px-5 py-4">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-lg">✅</span>
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
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-blue">{cat.label}</p>
                    <p className="mt-2 text-sm text-ink-light">{cat.subtitle}</p>
                  </div>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg">{cat.badge}</span>
                </div>
                <p className="mt-4 text-2xl font-black text-ink">{count}</p>
                <p className="mt-1 text-sm font-semibold text-brand-blue group-hover:text-header">{t("viewAll")} →</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("newArrivals")}</h2>
          <Link href={perfMode === "aggressive" ? "/listings?perf=aggressive" : "/listings"} className="text-sm font-semibold text-brand-blue hover:text-header">
            {t("viewAll")}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newArrivals.map((item, index) => (
            <Link
              key={item.id}
              href={`/listings/${item.id}`}
              className="group rounded-2xl border border-border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                {item.photos[0] && (
                  <ProgressiveImage
                    src={listingPhotoUrl(item.id, item.photos[0])}
                    alt={item.title}
                    eager={index < homeEagerCount}
                    fetchPriority={index < homeEagerCount ? "high" : "auto"}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                )}
                <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-brand-blue shadow-sm">
                  {item.listing_type === "auction" ? "AUCTION" : "FIXED"}
                </span>
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-ink">{item.title}</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-lg font-black text-ink">{item.listing_type === "auction" ? item.current_price : item.price}</p>
                <p className="text-xs text-ink-light line-through">
                  {Math.ceil(Number(item.listing_type === "auction" ? item.current_price : item.price) * 1.12)}
                </p>
              </div>
              <p className="mt-1 text-xs text-ink-light">
                {item.listing_type === "auction"
                  ? item.ends_at
                    ? formatRemaining(item.ends_at, tFormat)
                    : t("timeless")
                  : tListings("remainingUnits", { count: item.stock_remaining ?? 0 })}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-ink">Quick View</span>
                <span className="inline-flex rounded-md bg-header px-2 py-1 text-[11px] font-semibold text-white">Add To Cart</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 p-7 text-white lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider">{t("promoAuctionBadge")}</p>
            <h3 className="mt-2 text-3xl font-black">{t("promoAuctionTitle")}</h3>
            <p className="mt-3 max-w-xl text-sm text-blue-100">{t("promoAuctionDesc")}</p>
            <Link href={`/listings?type=auction${perfSuffix}`} className="mt-5 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-blue-700">
              {t("promoAuctionCta")}
            </Link>
          </div>

          <div className="grid gap-5">
            <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-slate-900 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-wider">{t("promoFixedBadge")}</p>
              <h3 className="mt-2 text-2xl font-black">{t("promoFixedTitle")}</h3>
              <p className="mt-3 text-sm text-blue-100">{t("promoFixedDesc")}</p>
              <Link href={`/listings?type=fixed_price${perfSuffix}`} className="mt-4 inline-flex rounded-md bg-white px-3 py-1.5 text-xs font-bold text-blue-700">
                {t("promoFixedCta")}
              </Link>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-blue">Up to 40% Off</p>
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
          <Link href="/listings" className="text-sm font-semibold text-brand-blue hover:text-header">
            {t("viewAll")}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bestMixed.map((item, index) => (
            <article key={`best-${item.id}`} className="group rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <Link href={`/listings/${item.id}`} className="block">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                  {item.photos[0] && (
                    <ProgressiveImage
                      src={listingPhotoUrl(item.id, item.photos[0])}
                      alt={item.title}
                      eager={index < 1}
                      fetchPriority={index < 1 ? "high" : "auto"}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] font-bold text-brand-blue shadow-sm">
                    {item.listing_type === "auction" ? "HOT BIDDING" : "BEST PRICE"}
                  </span>
                </div>
              </Link>

              <h3 className="mt-3 truncate text-sm font-semibold text-ink">{item.title}</h3>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-lg font-black text-ink">{item.listing_type === "auction" ? item.current_price : item.price}</p>
                <p className="text-xs text-ink-light line-through">
                  {Math.ceil(Number(item.listing_type === "auction" ? item.current_price : item.price) * 1.18)}
                </p>
              </div>

              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-ink">Quick View</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold text-ink">Add To Wishlist</span>
                <Link href={`/listings/${item.id}`} className="rounded-md bg-header px-2 py-1 font-semibold text-white">
                  Add To Cart
                </Link>
              </div>
            </article>
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
                  <p className="ml-3 shrink-0 text-sm font-bold text-gold">{item.current_price}</p>
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
                    <p className="text-xs text-ink-light">{tListings("remainingUnits", { count: item.stock_remaining ?? 0 })}</p>
                  </div>
                  <p className="ml-3 shrink-0 text-sm font-bold text-gold">{item.price}</p>
                </Link>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 p-7 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Enhance your bidding experience</p>
          <h2 className="mt-2 text-3xl font-black">Don’t Miss These Deals</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="rounded-md bg-white/15 px-3 py-1">06 Days</span>
            <span className="rounded-md bg-white/15 px-3 py-1">03 Hours</span>
            <span className="rounded-md bg-white/15 px-3 py-1">07 Minutes</span>
            <span className="rounded-md bg-white/15 px-3 py-1">20 Seconds</span>
          </div>
          <Link href="/listings" className="mt-5 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-blue-800">
            Check it Out
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold">User Feedbacks</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {feedbacks.map((item) => (
            <article key={item.role} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <p className="text-base leading-7 text-ink-light">“{item.quote}”</p>
              <div className="mt-4 flex items-center gap-1 text-yellow-400">
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
                <span>★</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{item.role}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
