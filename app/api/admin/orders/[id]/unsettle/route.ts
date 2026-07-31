import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unsettleOrder } from "@/lib/listings";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單" }, { status: 404 });
  }

  await unsettleOrder(orderId);
  return NextResponse.json({ ok: true });
}
