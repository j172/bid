import Link from "next/link";
import { listOpenListings } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { formatRemaining } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const listings = await listOpenListings();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold">競標中商品</h1>

      {listings.length === 0 && <p className="mt-6 text-ink-light">目前沒有開放中的商品。</p>}

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
              <h2 className="truncate font-semibold">{listing.title}</h2>
              <p className="mt-2 text-lg font-bold text-gold">{listing.current_price}</p>
              <p className="text-xs text-ink-light">買斷價 {listing.buy_it_now_price}</p>
              <p className="mt-1 text-xs text-ink-light">{formatRemaining(listing.ends_at)}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
