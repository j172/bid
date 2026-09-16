import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getBuyerProfileForProductOrder } from "@/lib/productOrders";
import { parseIdParam } from "@/lib/routeParams";

// Powers the admin product-orders page's expandable "買家資料" section —
// mirrors app/api/admin/orders/[id]/buyer/route.ts, against products'
// independent product_orders table instead of listings' purchases.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const orderId = parseIdParam(id);
  if (orderId === null) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單" }, { status: 404 });
  }

  const buyer = await getBuyerProfileForProductOrder(orderId);
  if (!buyer) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單的買家" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, buyer });
}
