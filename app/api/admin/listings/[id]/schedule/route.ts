import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getListingById, updateListingStartsAt } from "@/lib/listings";
import { validateStartsAt } from "@/lib/listingValidation";
import { parseIdParam } from "@/lib/routeParams";

// Admin-only: corrects a still-'scheduled' auction's start time (or clears
// it to open the listing immediately) — see updateListingStartsAt's comment
// for why this is scoped so much narrower than a full auction edit.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (listing.listing_type !== "auction" || listing.status !== "scheduled") {
    return NextResponse.json({ ok: false, error: "只有尚未開標的競標商品可以調整起標時間" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const startsAtRaw = body?.startsAt;
  const startsAt = startsAtRaw === null || startsAtRaw === undefined || startsAtRaw === "" ? null : new Date(String(startsAtRaw));

  if (startsAt !== null) {
    const startsAtResult = validateStartsAt(startsAt, listing.ends_at!);
    if (!startsAtResult.ok) {
      return NextResponse.json({ ok: false, error: startsAtResult.error }, { status: 400 });
    }
  }

  const result = await updateListingStartsAt(listingId, startsAt);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
