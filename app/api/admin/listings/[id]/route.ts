import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getListingById } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";

// Powers the admin edit modal (fixed_price listings — see
// EditListingModal.tsx) and the relist modal (closed auction listings with
// no winner — see RelistModal.tsx): fetches the current field values and
// photo URLs to pre-fill whichever form is asking.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const listing = await getListingById(listingId);
  if (!listing) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    listing: {
      title: listing.title,
      description: listing.description,
      price: listing.price,
      stockRemaining: listing.stock_remaining,
      startingPrice: listing.starting_price,
      buyItNowPrice: listing.buy_it_now_price,
      photos: listing.photos.map((fileName) => ({ fileName, url: listingPhotoUrl(listing.id, fileName) })),
    },
  });
}
