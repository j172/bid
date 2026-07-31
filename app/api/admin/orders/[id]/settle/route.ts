import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { markOrderSettled } from "@/lib/listings";
import { validateSettlement } from "@/lib/settlement";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
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
