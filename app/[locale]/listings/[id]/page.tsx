import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMinimumNextBid } from "@/lib/bidding/domain";
import { formatRemaining } from "@/lib/format";
import { getListingById, listOpenListings } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { Link } from "@/i18n/navigation";
import ZoomableProductImage from "../../components/ZoomableProductImage";
import StatusBadge from "../../components/StatusBadge";
import BidForm from "./BidForm";
import BuyNowButton from "./BuyNowButton";
import ListingDetailTabs from "./ListingDetailTabs";
import ListingGallery from "./ListingGallery";
import LiveListingStatus from "./LiveListingStatus";
import PurchaseForm from "./PurchaseForm";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isFinite(listingId)) {
    notFound();
  }

  const listing = await getListingById(listingId);
  if (!listing) {
    notFound();
  }

  const relatedListings = (await listOpenListings())
    .filter((candidate) => candidate.id !== listing.id)
    .slice(0, 6);

  const user = await getCurrentUser();
  const isOpen = listing.status === "open";
  const isScheduled = listing.status === "scheduled";
  const isFixedPrice = listing.listing_type === "fixed_price";
  const minimumNextBid = getMinimumNextBid(listing.current_price);
  const t = await getTranslations("listingDetail");
  const tNav = await getTranslations("nav");
  const tListings = await getTranslations("listings");
  const tFormat = await getTranslations("format");
  const imageUrls = listing.photos.map((fileName) => listingPhotoUrl(listing.id, fileName));

  const isAuction = listing.listing_type === "auction";
  const discountRate =
    isAuction && listing.buy_it_now_price && listing.buy_it_now_price > listing.current_price
      ? Math.max(1, Math.round(((listing.buy_it_now_price - listing.current_price) / listing.buy_it_now_price) * 100))
      : null;
  const stockLabel = isFixedPrice
    ? listing.stock_remaining === 0
      ? t("soldOut")
      : t("remainingUnits", { count: listing.stock_remaining ?? 0 })
    : isOpen
      ? t("inStock")
      : isScheduled
        ? t("statusScheduled")
        : t("ended");

  const specs = [
    { label: t("specType"), value: isAuction ? tListings("badgeAuction") : tListings("badgeFixedPrice") },
    {
      label: t("specStatus"),
      value: isScheduled ? t("statusScheduled") : isOpen ? t("statusLive") : t("statusEnded"),
    },
    { label: t("specCurrentPrice"), value: `${listing.current_price}` },
    {
      label: t("specBuyNow"),
      value: listing.buy_it_now_price !== null ? `${listing.buy_it_now_price}` : t("specNotAvailable"),
    },
    ...(listing.starts_at
      ? [{ label: t("specStartTime"), value: formatRemaining(listing.starts_at, tFormat, { prefixKey: "startsInPrefix", endedKey: "startingSoon" }) }]
      : []),
    {
      label: t("specEndTime"),
      value: listing.ends_at ? formatRemaining(listing.ends_at, tFormat) : t("specNoDeadline"),
    },
    {
      label: t("specStock"),
      value: isFixedPrice ? `${listing.stock_remaining ?? 0}` : t("specSingleItem"),
    },
  ];

  const reviewLines = [
    t("reviewHintOne"),
    t("reviewHintTwo"),
    t("reviewHintThree"),
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
          <Link href="/" className="hover:text-gold">
            {tNav("home")}
          </Link>{" "}
          /{" "}
          <Link href="/listings" className="hover:text-gold">
            {tNav("browse")}
          </Link>{" "}
          / {t("shopDetails")}
        </p>
        <h1 className="mt-2 text-3xl font-black text-ink">{listing.title}</h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <ListingGallery title={listing.title} imageUrls={imageUrls} />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-3">
              {discountRate !== null && (
                <span className="rounded-full bg-brand-chip px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-blue">
                  {discountRate}% {t("off")}
                </span>
              )}
              <span className="text-sm text-ink-light">(0 {t("customerReviews")})</span>
            </div>
            <p className="mt-4 text-sm font-semibold text-ink-light">{stockLabel}</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-light">{t("priceLabel")}</p>
            {isFixedPrice ? (
              <div className="flex flex-col gap-1">
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-4xl font-black text-brand-blue">{listing.price}</span>
                  <StatusBadge status={listing.status} />
                </div>
                <p className="text-sm text-ink-light">{stockLabel}</p>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-end gap-3">
                  {listing.buy_it_now_price !== null && (
                    <span className="text-lg text-ink-light line-through">{listing.buy_it_now_price}</span>
                  )}
                  <span className="text-4xl font-black text-brand-blue">{listing.current_price}</span>
                </div>
                <LiveListingStatus
                  listingId={listing.id}
                  initialCurrentPrice={listing.current_price}
                  initialEndsAt={listing.ends_at!.toISOString()}
                  initialStartsAt={listing.starts_at ? listing.starts_at.toISOString() : null}
                  initialStatus={listing.status}
                />
                {listing.buy_it_now_price !== null && (
                  <p className="mt-3 inline-flex w-fit rounded-md bg-gold-light px-2 py-1 text-sm font-medium text-gold-dark">
                    {t("buyItNowPrice", { price: listing.buy_it_now_price })}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 space-y-2 border-t border-border pt-5 text-sm text-ink-light">
              <p>{t("benefitOne")}</p>
              <p>{t("benefitTwo")}</p>
              <p>{t("benefitThree")}</p>
            </div>

            {isScheduled && listing.starts_at && (
              <p className="mt-6 border-t border-border pt-6 text-sm font-medium text-brand-blue">
                {t("scheduledNotice", { time: formatRemaining(listing.starts_at, tFormat, { prefixKey: "startsInPrefix", endedKey: "startingSoon" }) })}
              </p>
            )}

            {isOpen &&
              (user ? (
                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6">
                  {isFixedPrice ? (
                    <div className="rounded-xl border border-border bg-surface p-4">
                      <PurchaseForm listingId={listing.id} stockRemaining={listing.stock_remaining ?? 0} />
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-border bg-surface p-4">
                        <BidForm listingId={listing.id} minimumNextBid={minimumNextBid} />
                      </div>
                      {listing.buy_it_now_price !== null && (
                        <div className="rounded-xl border border-brand-blue/20 bg-brand-chip p-4">
                          <BuyNowButton listingId={listing.id} buyItNowPrice={listing.buy_it_now_price} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-6 border-t border-border pt-6 text-sm text-ink-light">
                  <Link href="/login" className="font-medium text-gold hover:underline">
                    {t("loginPrompt")}
                  </Link>
                  {isFixedPrice ? t("loginToBuy") : t("loginToBidOrBuy")}
                </p>
              ))}
          </div>
        </div>
      </div>

      <ListingDetailTabs
        descriptionLabel={t("descriptionTab")}
        additionalLabel={t("additionalTab")}
        reviewsLabel={t("reviewsTab")}
        descriptionTitle={t("descriptionHeading")}
        additionalTitle={t("additionalHeading")}
        reviewsTitle={t("reviewsHeading")}
        description={listing.description}
        specs={specs}
        reviewLines={reviewLines}
      />

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-ink">{t("recentlyViewed")}</h2>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {relatedListings.map((related) => (
            <Link
              key={related.id}
              href={`/listings/${related.id}`}
              className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <ZoomableProductImage
                  src={related.photos[0] ? listingPhotoUrl(related.id, related.photos[0]) : "/images/hero-placeholder.png"}
                  alt={related.title}
                  eager={false}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  zoomPreset="high"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/5 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="absolute bottom-3 left-1/2 w-[calc(100%-1.5rem)] -translate-x-1/2 translate-y-3 rounded-md bg-white/95 px-3 py-2 text-center text-xs font-bold text-brand-blue opacity-0 shadow-sm transition group-hover:translate-y-0 group-hover:opacity-100">
                  {t("viewDetails")}
                </div>
              </div>
              <div className="p-4">
                <h3 className="truncate font-semibold text-ink">{related.title}</h3>
                <p className="mt-2 text-lg font-black text-brand-blue">
                  {related.listing_type === "fixed_price" ? related.price : related.current_price}
                </p>
                <p className="mt-2 inline-flex rounded-full bg-brand-chip px-2 py-0.5 text-xs font-semibold text-brand-blue">
                  {t("viewDetails")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
