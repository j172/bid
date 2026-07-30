import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getMinimumNextBid } from "@/lib/bidding/domain";
import { getListingById } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import BidForm from "./BidForm";
import BuyNowButton from "./BuyNowButton";
import LiveListingStatus from "./LiveListingStatus";

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
  const minimumNextBid = getMinimumNextBid(listing.current_price);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted">
            {listing.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listingPhotoUrl(listing.id, listing.photos[0])}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          {listing.photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {listing.photos.slice(1).map((fileName) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={fileName}
                  src={listingPhotoUrl(listing.id, fileName)}
                  alt={listing.title}
                  className="h-20 w-20 flex-shrink-0 rounded-md border border-border object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold">{listing.title}</h1>
            <p className="mt-3 whitespace-pre-wrap text-ink-light">{listing.description}</p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <LiveListingStatus
              listingId={listing.id}
              initialCurrentPrice={listing.current_price}
              initialEndsAt={listing.ends_at.toISOString()}
              initialStatus={listing.status}
            />
            {listing.buy_it_now_price !== null && (
              <p className="mt-3 text-sm text-ink-light">買斷價 {listing.buy_it_now_price}</p>
            )}

            {isOpen &&
              (user ? (
                <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6">
                  <BidForm listingId={listing.id} minimumNextBid={minimumNextBid} />
                  {listing.buy_it_now_price !== null && (
                    <BuyNowButton listingId={listing.id} buyItNowPrice={listing.buy_it_now_price} />
                  )}
                </div>
              ) : (
                <p className="mt-6 border-t border-border pt-6 text-sm text-ink-light">
                  <Link href="/login" className="font-medium text-gold hover:underline">
                    登入
                  </Link>
                  後才能出價或買斷
                </p>
              ))}
          </div>
        </div>
      </div>
    </main>
  );
}
