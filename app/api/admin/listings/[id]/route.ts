import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getListingById } from "@/lib/listings";
import { listingPhotoUrl } from "@/lib/uploads";
import { parseIdParam } from "@/lib/routeParams";

// Powers the admin edit modal (fixed_price listings — see
// EditListingModal.tsx) and the relist modal (closed auction listings with
// no winner — see RelistModal.tsx): fetches the current field values and
// photo URLs to pre-fill whichever form is asking.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const listingId = parseIdParam(id);
  if (listingId === null) {
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
      loftId: listing.loft_id,
      photos: listing.photos.map((fileName) => ({ fileName, url: listingPhotoUrl(listing.id, fileName) })),
    },
  });
}
