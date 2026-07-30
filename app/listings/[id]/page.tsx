import { notFound } from "next/navigation";
import { getListingById } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { formatRemaining } from "@/lib/format";

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

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>{listing.title}</h1>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {listing.photos.map((fileName) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={fileName}
            src={listingPhotoUrl(listing.id, fileName)}
            alt={listing.title}
            style={{ maxWidth: 240 }}
          />
        ))}
      </div>
      <p style={{ whiteSpace: "pre-wrap" }}>{listing.description}</p>
      <ul>
        <li>目前價格：{listing.starting_price}</li>
        <li>買斷價：{listing.buy_it_now_price}</li>
        <li>{formatRemaining(listing.ends_at)}</li>
        <li>狀態：{listing.status === "open" ? "競標中" : "已結標"}</li>
      </ul>
    </main>
  );
}
