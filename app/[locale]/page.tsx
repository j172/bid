import { getTranslations } from "next-intl/server";
import { preload } from "react-dom";
import { getDb } from "@/lib/db";
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

async function checkDb(): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = await getDb();
    await db.query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const perfMode = perfModeFromSearchParams(params);
  const db = await checkDb();
  const t = await getTranslations("home");
  const tListings = await getTranslations("listings");
  const tFormat = await getTranslations("format");
  const status = db.ok ? t("dbConnected") : t("dbFailed", { error: db.error ?? "" });
  const listings = await listOpenListings();

  const featured = listings.slice(0, 3);
  const newArrivals = listings.slice(0, 8);
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
  const homeEagerCount = perfMode === "aggressive" ? 3 : 2;
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

  if (featured[0]?.photos[0]) {
    preload(listingPhotoUrl(featured[0].id, featured[0].photos[0]), {
      as: "image",
      fetchPriority: "high",
    });
  }

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

      <p className="mx-auto max-w-6xl px-4 py-3 text-center text-xs text-ink-light sm:px-6">
        {t("serverStatus", { status })}
      </p>

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="text-xl font-bold">{t("bestAuction")}</h3>
            <div className="mt-4 space-y-3">
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

          <article className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="text-xl font-bold">{t("bestFixed")}</h3>
            <div className="mt-4 space-y-3">
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
        <h2 className="text-2xl font-bold">{t("feedbackTitle")}</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {feedbacks.map((item) => (
            <article key={item.role} className="rounded-xl border border-border bg-white p-5 shadow-sm">
              <p className="text-sm leading-7 text-ink-light">“{item.quote}”</p>
              <p className="mt-4 text-sm font-semibold text-ink">{item.role}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
