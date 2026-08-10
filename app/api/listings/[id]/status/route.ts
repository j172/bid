import { NextResponse } from "next/server";
import { getListingStatus } from "@/lib/listings";
import { parseIdParam } from "@/lib/routeParams";

// Plain, unauthenticated GET — browsing/watching a listing is already
// public, so there's no reason to gate the live-status poll behind login.
// Polled every few seconds by
// app/[locale]/listings/(no-loading)/[id]/LiveListingStatus.tsx while
// a listing is open; deliberately cheap (see getListingStatus) since it's
// hit repeatedly by every viewer's tab.
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = parseIdParam(id);
  if (listingId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const status = await getListingStatus(listingId);
  if (!status) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      currentPrice: status.currentPrice,
      endsAt: status.endsAt,
      startsAt: status.startsAt,
      status: status.status,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
