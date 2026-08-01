import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { placeBid } from "@/lib/listings";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorCode: "MUST_LOGIN" }, { status: 401 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ ok: false, errorCode: "NOT_FOUND" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const maxAmount = Number(body?.maxAmount);

  const result = await placeBid(listingId, user.id, maxAmount);
  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      { ok: false, errorCode: result.errorCode, minimumNextBid: result.minimumNextBid },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    currentPrice: result.currentPrice,
    youAreLeading: result.youAreLeading,
    closedViaBuyItNow: result.closedViaBuyItNow,
  });
}
