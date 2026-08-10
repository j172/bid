import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { placeBid } from "@/lib/listings";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const listingId = parseIdParam(id);
  if (listingId === null) {
    return NextResponse.json({ ok: false, errorCode: "NOT_FOUND" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const maxAmount = Number(body?.maxAmount);

  const result = await placeBid(listingId, auth.user.id, maxAmount);
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
