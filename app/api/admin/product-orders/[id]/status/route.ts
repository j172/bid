import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { updateProductOrderStatus, type ProductOrderStatus } from "@/lib/productOrders";
import { parseIdParam } from "@/lib/routeParams";

const VALID_STATUSES: ProductOrderStatus[] = ["pending", "shipped", "completed", "cancelled", "refunded"];

function isProductOrderStatus(value: unknown): value is ProductOrderStatus {
  return typeof value === "string" && (VALID_STATUSES as string[]).includes(value);
}

// Admin status-transition endpoint (issue #298) — 標記出貨／完成／取消／退款，
// with an optional free-text tracking number. Validity of the transition
// itself (e.g. rejecting completed -> shipped) is enforced by
// lib/productOrders.ts's resolveProductOrderStatusTransition inside
// updateProductOrderStatus, not here.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const orderId = parseIdParam(id);
  if (orderId === null) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!isProductOrderStatus(status)) {
    return NextResponse.json({ ok: false, error: "無效的訂單狀態" }, { status: 400 });
  }

  // Tracking number is optional free text (issue #298: no buyer-facing
  // tracking page, admin just records it if they have one) — undefined
  // means "leave the stored value untouched", an empty string means "clear
  // it", matching updateProductOrderStatus's own trackingNumber contract.
  const trackingNumberRaw = body?.trackingNumber;
  const trackingNumber =
    trackingNumberRaw === undefined ? undefined : String(trackingNumberRaw).trim() === "" ? null : String(trackingNumberRaw).trim();

  const result = await updateProductOrderStatus(orderId, status, trackingNumber);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
