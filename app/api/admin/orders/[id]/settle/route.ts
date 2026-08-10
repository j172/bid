import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { markOrderSettled } from "@/lib/listings";
import { validateSettlement } from "@/lib/settlement";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const orderId = parseIdParam(id);
  if (orderId === null) {
    return NextResponse.json({ ok: false, error: "找不到這筆訂單" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const account = typeof body?.account === "string" ? body.account : "";
  const amount = Number(body?.amount);

  const result = validateSettlement({ account, amount });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await markOrderSettled(orderId, account.trim(), amount);
  return NextResponse.json({ ok: true });
}
