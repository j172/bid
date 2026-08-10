import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getBuyerProfileForOrder } from "@/lib/listings";
import { parseIdParam } from "@/lib/routeParams";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const orderId = parseIdParam(id);
  if (orderId === null) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單" }, { status: 404 });
  }

  const buyer = await getBuyerProfileForOrder(orderId);
  if (!buyer) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單的買家" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, buyer });
}
