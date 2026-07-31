import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBuyerProfileForOrder } from "@/lib/listings";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單" }, { status: 404 });
  }

  const buyer = await getBuyerProfileForOrder(orderId);
  if (!buyer) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單的買家" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, buyer });
}
