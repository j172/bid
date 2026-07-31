import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWinnerProfileForListing } from "@/lib/listings";

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

  const winner = await getWinnerProfileForListing(listingId);
  if (!winner) {
    return NextResponse.json({ ok: false, error: "這個商品沒有得標者" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, winner });
}
