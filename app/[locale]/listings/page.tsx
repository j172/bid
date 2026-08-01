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
  const type = (Array.isArray(typeParam) ? typeParam[0] : typeParam) as ListingType | undefined;
  const perfMode = perfModeFromSearchParams(params);
  const gridEagerCount = perfMode === "aggressive" ? 6 : 4;

  const listings = await listOpenListings(type);
  const t = await getTranslations("listings");
  const tFormat = await getTranslations("format");
  const anonymousBuyer = await getTranslations("mask").then((tMask) => tMask("anonymousBuyer"));

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
            <p className="text-ink-light">{t("showingCount", { count: listings.length })}</p>
            <p className="font-semibold text-ink">{type ? t("filtered") : t("allLive")}</p>
          </div>

          {listings.length === 0 && <p className="mt-6 text-ink-light">{t("noListings")}</p>}

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing, index) => (
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
