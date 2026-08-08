import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMinimumNextBid } from "@/lib/bidding/domain";
import { currencyForLocale, formatConvertedApprox, formatNtd } from "@/lib/currency";
import { getLatestStoredRate } from "@/lib/exchangeRates";
import { formatRemaining } from "@/lib/format";
import { maskDisplayName } from "@/lib/mask";
import { getListingActivityFeed, getListingById, listOpenListings } from "@/lib/listings";
import { absoluteUrl, buildListingProductJsonLd, stripHtmlToPlainText, truncateForMetaDescription } from "@/lib/seo";
import { listingPhotoUrl } from "@/lib/uploads";
import { getPathname, Link } from "@/i18n/navigation";
// Absolute imports (rather than relative "../../../components/...") because
// this page moved into the (no-loading) route group (issue #74) — see that
// group's sibling (with-loading)/ folder for why.
import ZoomableProductImage from "@/app/[locale]/components/ZoomableProductImage";
import StatusBadge from "@/app/[locale]/components/StatusBadge";
import BidForm from "./BidForm";
import BuyNowButton from "./BuyNowButton";
import HeroCountdownStrip from "./HeroCountdownStrip";
import ListingDetailTabs from "./ListingDetailTabs";
import ListingGallery from "./ListingGallery";
import LiveListingStatus from "./LiveListingStatus";
import PurchaseForm from "./PurchaseForm";

export const dynamic = "force-dynamic";

// Per-listing <title>/<meta description> (issue #107 item 1) — built from
// the listing's own title/description rather than a generic site-wide
// string, so search results (and shared links) show what the product
// actually is. `title` returns a plain string, not an object, so it flows
// through the root layout's title.template (" | <site name>") automatically
// — see app/[locale]/layout.tsx's generateMetadata.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isFinite(listingId)) return {};

  const listing = await getListingById(listingId);
  if (!listing) return {};

  const description = truncateForMetaDescription(stripHtmlToPlainText(listing.description));
  const imageUrl = listing.photos[0]
    ? absoluteUrl(listingPhotoUrl(listing.id, listing.photos[0]))
    : absoluteUrl("/images/hero-placeholder.png");

  return {
    title: listing.title,
    description,
    openGraph: {
      title: listing.title,
      description,
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: listing.title,
      description,
      images: [imageUrl],
    },
  };
}

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
  const tAutoBid = await getTranslations("autoBiddingInfo");
  const tMask = await getTranslations("mask");
  const locale = await getLocale();
  const imageUrls = listing.photos.map((fileName) => listingPhotoUrl(listing.id, fileName));

  // Reference-only currency conversion (issue #45) — public pages only
  // (admin stays pure NTD). zh-TW visitors get "TWD" back (no conversion
  // needed); zh-CN/en get the latest synced rate, or null before the first
  // successful sync, in which case formatConvertedApprox below just omits
  // the secondary line entirely.
  const displayCurrency = currencyForLocale(locale);
  const displayRate = displayCurrency === "TWD" ? null : await getLatestStoredRate(displayCurrency);
  const rateValue = displayRate?.rate ?? null;

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
    { label: t("specCurrentPrice"), value: formatNtd(listing.current_price) },
    {
      label: t("specBuyNow"),
      value: listing.buy_it_now_price !== null ? formatNtd(listing.buy_it_now_price) : t("specNotAvailable"),
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

  // Public bid/transaction activity feed (issue #45) — no login required.
  // Source table auto-switches on listing type (see getListingActivityFeed's
  // own header comment): auction listings read `bids`, fixed_price listings
  // read `purchases`. Masked here (not in the lib layer) to match the
  // existing convention of masking at the page level — see
  // maskDisplayName(listing.leaderDisplayName, ...) on the listings grid.
  const activityFeed = await getListingActivityFeed(listing.id, listing.listing_type);
  const activityDateFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const anonymousBuyer = tMask("anonymousBuyer");
  const activityLines = activityFeed.entries.map((entry) => ({
    maskedName: maskDisplayName(entry.displayName, anonymousBuyer),
    amountLabel: `${entry.amount}`,
    dateLabel: activityDateFormatter.format(entry.createdAt),
  }));

  // Captured once per request and passed to every client component that
  // seeds a countdown from it — see useListingCountdown for why this needs
  // to be a stable prop rather than each client component calling
  // Date.now() itself (hydration mismatch).
  const renderedAt = new Date().toISOString();

  // schema.org Product/Offer JSON-LD (issue #107 item 3) — lets Google show
  // rich-result price/availability and gives AI/GEO crawlers a structured
  // read on the listing. See lib/seo.ts's buildListingProductJsonLd for the
  // field mapping/availability rules.
  const listingPathname = getPathname({ href: `/listings/${listing.id}`, locale });
  const productJsonLd = buildListingProductJsonLd(listing, listingPathname);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* JSON-LD requires raw <script> content; productJsonLd is server-built from trusted DB fields, not user-supplied markup. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
          <Link href="/" className="hover:text-interactive-primary">
            {tNav("home")}
          </Link>{" "}
          /{" "}
          <Link href="/listings" className="hover:text-interactive-primary">
            {tNav("browse")}
          </Link>{" "}
          / {t("shopDetails")}
        </p>
        <h1 className="mt-2 text-3xl font-black text-ink">{listing.title}</h1>
      </div>

      {isAuction && (
        <div className="mt-6">
          <HeroCountdownStrip
            listingId={listing.id}
            imageUrl={imageUrls[0] ?? "/images/hero-placeholder.png"}
            initialCurrentPrice={listing.current_price}
            initialBuyItNowPrice={listing.buy_it_now_price}
            initialEndsAt={listing.ends_at!.toISOString()}
            initialStartsAt={listing.starts_at ? listing.starts_at.toISOString() : null}
            initialStatus={listing.status}
            renderedAt={renderedAt}
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <ListingGallery title={listing.title} imageUrls={imageUrls} />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-3">
              {discountRate !== null && (
                <span className="rounded-full bg-interactive-primary-subtle px-3 py-1 text-xs font-black uppercase tracking-wide text-interactive-primary">
                  {discountRate}% {t("off")}
                </span>
              )}
            </div>
            <p className="mt-4 text-sm font-semibold text-ink-light">{stockLabel}</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-ink-light">{t("priceLabel")}</p>
            {isFixedPrice ? (
              <div className="flex flex-col gap-1">
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-4xl font-black text-interactive-primary">{formatNtd(listing.price!)}</span>
                  <StatusBadge status={listing.status} isFixedPrice />
                </div>
                {formatConvertedApprox(listing.price!, displayCurrency, rateValue) && (
                  <p className="text-sm font-semibold text-ink-light">
                    {formatConvertedApprox(listing.price!, displayCurrency, rateValue)}{" "}
                    <span className="text-xs font-normal italic">({t("currencyReferenceOnly")})</span>
                  </p>
                )}
                <p className="text-sm text-ink-light">{stockLabel}</p>
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-end gap-3">
                  {listing.buy_it_now_price !== null && (
                    <span className="text-lg text-ink-light line-through">{formatNtd(listing.buy_it_now_price)}</span>
                  )}
                  <span className="text-4xl font-black text-interactive-primary">{formatNtd(listing.current_price)}</span>
                </div>
                {formatConvertedApprox(listing.current_price, displayCurrency, rateValue) && (
                  <p className="mb-3 text-sm font-semibold text-ink-light">
                    {formatConvertedApprox(listing.current_price, displayCurrency, rateValue)}{" "}
                    <span className="text-xs font-normal italic">({t("currencyReferenceOnly")})</span>
                  </p>
                )}
                <LiveListingStatus
                  listingId={listing.id}
                  initialCurrentPrice={listing.current_price}
                  initialEndsAt={listing.ends_at!.toISOString()}
                  initialStartsAt={listing.starts_at ? listing.starts_at.toISOString() : null}
                  initialStatus={listing.status}
                  renderedAt={renderedAt}
                />
                {listing.buy_it_now_price !== null && (
                  <p className="mt-3 inline-flex w-fit rounded-md bg-interactive-primary-subtle px-2 py-1 text-sm font-medium text-interactive-primary-active">
                    {t("buyItNowPrice", { price: formatNtd(listing.buy_it_now_price) })}
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
              <p className="mt-6 border-t border-border pt-6 text-sm font-medium text-interactive-primary">
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
                      <div className="rounded-xl border border-interactive-primary/20 bg-interactive-primary-subtle p-4 text-xs text-ink-light">
                        <p className="font-bold text-ink">{tAutoBid("title")}</p>
                        <p className="mt-1">{tAutoBid("description")}</p>
                        <ol className="mt-2 list-decimal space-y-1 pl-4">
                          <li>{tAutoBid("step1")}</li>
                          <li>{tAutoBid("step2")}</li>
                          <li>{tAutoBid("step3")}</li>
                        </ol>
                      </div>
                      {listing.buy_it_now_price !== null && (
                        <div className="rounded-xl border border-interactive-primary/20 bg-interactive-primary-subtle p-4">
                          <BuyNowButton listingId={listing.id} buyItNowPrice={listing.buy_it_now_price} />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-6 border-t border-border pt-6 text-sm text-ink-light">
                  <Link href="/login" className="font-medium text-interactive-primary hover:underline">
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
        activityLabel={t("activityTab")}
        descriptionTitle={t("descriptionHeading")}
        additionalTitle={t("additionalHeading")}
        activityTitle={t("activityHeading")}
        description={listing.description}
        specs={specs}
        activityTotalCountLabel={
          isFixedPrice
            ? t("activityTotalPurchases", { count: activityFeed.totalCount })
            : t("activityTotalBids", { count: activityFeed.totalCount })
        }
        activityLines={activityLines}
        activityEmptyLabel={isFixedPrice ? t("activityEmptyPurchases") : t("activityEmptyBids")}
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
                <div className="absolute bottom-3 left-1/2 w-[calc(100%-1.5rem)] -translate-x-1/2 translate-y-3 rounded-md bg-white/95 px-3 py-2 text-center text-xs font-bold text-interactive-primary opacity-0 shadow-sm transition group-hover:translate-y-0 group-hover:opacity-100">
                  {t("viewDetails")}
                </div>
              </div>
              <div className="p-4">
                <h3 className="truncate font-semibold text-ink">{related.title}</h3>
                <p className="mt-2 text-lg font-black text-interactive-primary">
                  {formatNtd(related.listing_type === "fixed_price" ? related.price! : related.current_price)}
                </p>
                <p className="mt-2 inline-flex rounded-full bg-interactive-primary-subtle px-2 py-0.5 text-xs font-semibold text-interactive-primary">
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
