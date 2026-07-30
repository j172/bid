import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { placeBid } from "@/lib/listings";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);

  const result = await placeBid(listingId, user.id, amount);
  if (!result.ok) {
    const status = result.error === "找不到這個商品" ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, currentPrice: result.newPrice });
}
