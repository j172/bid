import Link from "next/link";
import { listOpenListings } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { formatRemaining } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const listings = await listOpenListings();

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>競標中商品</h1>
      {listings.length === 0 && <p>目前沒有開放中的商品。</p>}
      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
        {listings.map((listing) => (
          <li key={listing.id} style={{ border: "1px solid #ccc", borderRadius: 8, padding: "1rem" }}>
            <Link href={`/listings/${listing.id}`}>
              <h2 style={{ margin: 0 }}>{listing.title}</h2>
            </Link>
            {listing.photos[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listingPhotoUrl(listing.id, listing.photos[0])}
                alt={listing.title}
                style={{ maxWidth: 200, display: "block", margin: "0.5rem 0" }}
              />
            )}
            <p>目前價格：{listing.starting_price}</p>
            <p>買斷價：{listing.buy_it_now_price}</p>
            <p>{formatRemaining(listing.ends_at)}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
