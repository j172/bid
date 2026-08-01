import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMinimumNextBid } from "@/lib/bidding/domain";
import { getListingById } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { Link } from "@/i18n/navigation";
import StatusBadge from "../../components/StatusBadge";
import BidForm from "./BidForm";
import BuyNowButton from "./BuyNowButton";
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

  const user = await getCurrentUser();
  const isOpen = listing.status === "open";
  const isFixedPrice = listing.listing_type === "fixed_price";
  const minimumNextBid = getMinimumNextBid(listing.current_price);
  const t = await getTranslations("listingDetail");
  const tNav = await getTranslations("nav");
  const imageUrls = listing.photos.map((fileName) => listingPhotoUrl(listing.id, fileName));

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-xl bg-white px-5 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">
          <Link href="/" className="hover:text-gold">
            {tNav("home")}
          </Link>{" "}
          /{" "}
          <Link href="/listings" className="hover:text-gold">
            {tNav("browse")}
          </Link>{" "}
          / {listing.title}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="mt-6 flex flex-col gap-3">
          <ListingGallery title={listing.title} imageUrls={imageUrls} />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-black">{listing.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-ink-light">{listing.description}</p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            {isFixedPrice ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-gold">{listing.price}</span>
                  <StatusBadge status={listing.status} />
                </div>
                <p className="text-sm text-ink-light">
                  {listing.stock_remaining === 0
                    ? t("soldOut")
                    : t("remainingUnits", { count: listing.stock_remaining ?? 0 })}
                </p>
              </div>
            ) : (
              <>
                <LiveListingStatus
                  listingId={listing.id}
                  initialCurrentPrice={listing.current_price}
                  initialEndsAt={listing.ends_at!.toISOString()}
                  initialStatus={listing.status}
                />
                {listing.buy_it_now_price !== null && (
                  <p className="mt-3 inline-flex w-fit rounded-md bg-gold-light px-2 py-1 text-sm font-medium text-gold-dark">
                    {t("buyItNowPrice", { price: listing.buy_it_now_price })}
                  </p>
                )}
              </>
            )}

            {isOpen &&
              (user ? (
                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6">
                  {isFixedPrice ? (
                    <PurchaseForm listingId={listing.id} stockRemaining={listing.stock_remaining ?? 0} />
                  ) : (
                    <>
                      <BidForm listingId={listing.id} minimumNextBid={minimumNextBid} />
                      {listing.buy_it_now_price !== null && (
                        <BuyNowButton listingId={listing.id} buyItNowPrice={listing.buy_it_now_price} />
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
    </main>
  );
}
