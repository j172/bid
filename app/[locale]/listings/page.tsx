import { getTranslations } from "next-intl/server";
import { listOpenListings, type ListingType } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { formatRemaining } from "@/lib/format";
import { maskDisplayName } from "@/lib/mask";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

const DESCRIPTION_SNIPPET_LENGTH = 30;

type SearchParams = Record<string, string | string[] | undefined>;

function descriptionSnippet(description: string): string {
  const trimmed = description.trim();
  return trimmed.length > DESCRIPTION_SNIPPET_LENGTH
    ? `${trimmed.slice(0, DESCRIPTION_SNIPPET_LENGTH)}…`
    : trimmed;
}

export default async function ListingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const typeParam = params.type;
  const type = (Array.isArray(typeParam) ? typeParam[0] : typeParam) as ListingType | undefined;

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
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="mt-4 flex gap-2">
        {TYPE_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/listings?type=${tab.value}` : "/listings"}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${
              (type ?? "") === tab.value
                ? "border-gold bg-gold-light text-gold-dark"
                : "border-border text-ink-light hover:bg-surface-muted"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {listings.length === 0 && <p className="mt-6 text-ink-light">{t("noListings")}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}`}
            className="group overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition hover:shadow-md"
          >
            <div className="aspect-square overflow-hidden bg-surface-muted">
              {listing.photos[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listingPhotoUrl(listing.id, listing.photos[0])}
                  alt={listing.title}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              )}
            </div>
            <div className="p-4">
              <span className="inline-block rounded-full bg-gold-light px-2 py-0.5 text-xs font-medium text-gold-dark">
                {TYPE_BADGE_LABEL[listing.listing_type]}
              </span>
              <h2 className="mt-2 truncate font-semibold">{listing.title}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-ink-light">{descriptionSnippet(listing.description)}</p>

              {listing.listing_type === "fixed_price" ? (
                <>
                  <p className="mt-2 text-lg font-bold text-gold">{listing.price}</p>
                  <p className="mt-1 text-xs text-ink-light">
                    {listing.stock_remaining === 0
                      ? t("soldOut")
                      : t("remainingUnits", { count: listing.stock_remaining ?? 0 })}
                  </p>
                  <p className="mt-1 text-xs text-ink-light">{t("totalPurchases", { count: listing.purchaseCount })}</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-lg font-bold text-gold">{listing.current_price}</p>
                  {listing.buy_it_now_price !== null && (
                    <p className="text-xs text-ink-light">{t("buyItNowPrice", { price: listing.buy_it_now_price })}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-light">
                    {listing.ends_at && formatRemaining(listing.ends_at, tFormat)}
                  </p>
                  <p className="mt-1 text-xs text-ink-light">
                    {listing.bidCount === 0
                      ? t("noBidsYet")
                      : t("currentLeader", { name: maskDisplayName(listing.leaderDisplayName, anonymousBuyer) })}
                  </p>
                  <p className="text-xs text-ink-light">{t("totalBids", { count: listing.bidCount })}</p>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
