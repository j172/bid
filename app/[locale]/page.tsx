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

      <section className="mx-auto mt-8 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t("serviceFast")}</p>
            <p className="mt-2 text-sm text-ink-light">{t("serviceFastDesc")}</p>
          </article>
          <article className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t("serviceSecure")}</p>
            <p className="mt-2 text-sm text-ink-light">{t("serviceSecureDesc")}</p>
          </article>
          <article className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{t("serviceSupport")}</p>
            <p className="mt-2 text-sm text-ink-light">{t("serviceSupportDesc")}</p>
          </article>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">{t("newArrivals")}</h2>
          <Link href={perfMode === "aggressive" ? "/listings?perf=aggressive" : "/listings"} className="text-sm font-semibold text-gold hover:text-gold-dark">
            {t("viewAll")}
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newArrivals.map((item, index) => (
            <Link key={item.id} href={`/listings/${item.id}`} className="group rounded-xl border border-border bg-white p-3 shadow-sm hover:shadow-md">
              <div className="aspect-square overflow-hidden rounded-lg bg-slate-100">
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
              </div>
              <p className="mt-3 truncate text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-lg font-black text-gold">
                {item.listing_type === "auction" ? item.current_price : item.price}
              </p>
              <p className="mt-1 text-xs text-ink-light">
                {item.listing_type === "auction"
                  ? item.ends_at
                    ? formatRemaining(item.ends_at, tFormat)
                    : t("timeless")
                  : tListings("remainingUnits", { count: item.stock_remaining ?? 0 })}
              </p>
              <p className="mt-2 text-xs font-semibold text-brand-blue">{t("cardCta")}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-wider">{t("promoAuctionBadge")}</p>
            <h3 className="mt-2 text-2xl font-black">{t("promoAuctionTitle")}</h3>
            <p className="mt-3 text-sm text-blue-100">{t("promoAuctionDesc")}</p>
            <Link href={`/listings?type=auction${perfSuffix}`} className="mt-5 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-blue-700">
              {t("promoAuctionCta")}
            </Link>
          </div>
          <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-slate-900 p-7 text-white">
            <p className="text-xs font-bold uppercase tracking-wider">{t("promoFixedBadge")}</p>
            <h3 className="mt-2 text-2xl font-black">{t("promoFixedTitle")}</h3>
            <p className="mt-3 text-sm text-blue-100">{t("promoFixedDesc")}</p>
            <Link href={`/listings?type=fixed_price${perfSuffix}`} className="mt-5 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-blue-700">
              {t("promoFixedCta")}
            </Link>
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
    </main>
  );
}
