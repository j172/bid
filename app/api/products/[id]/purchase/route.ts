import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { purchaseProduct } from "@/lib/productOrders";
import { parseIdParam } from "@/lib/routeParams";

// Buyer-facing purchase endpoint for `products` (issue #298) — mirrors
// app/api/listings/[id]/purchase/route.ts exactly, just against
// lib/productOrders.ts's purchaseProduct instead of purchaseListing.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const productId = parseIdParam(id);
  if (productId === null) {
    return NextResponse.json({ ok: false, errorCode: "NOT_FOUND" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const quantity = Number(body?.quantity);

  const result = await purchaseProduct(productId, auth.user.id, quantity);
  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status });
  }

  return NextResponse.json({ ok: true });
}
