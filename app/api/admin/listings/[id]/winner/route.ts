import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getWinnerProfileForListing } from "@/lib/listings";
import { parseIdParam } from "@/lib/routeParams";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const listingId = parseIdParam(id);
  if (listingId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const winner = await getWinnerProfileForListing(listingId);
  if (!winner) {
    return NextResponse.json({ ok: false, error: "這個商品沒有得標者" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, winner });
}
