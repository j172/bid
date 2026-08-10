import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { unsettleOrder } from "@/lib/listings";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const orderId = parseIdParam(id);
  if (orderId === null) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單" }, { status: 404 });
  }

  await unsettleOrder(orderId);
  return NextResponse.json({ ok: true });
}
