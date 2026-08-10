import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { buyNow } from "@/lib/listings";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const listingId = parseIdParam(id);
  if (listingId === null) {
    return NextResponse.json({ ok: false, errorCode: "NOT_FOUND" }, { status: 404 });
  }

  const result = await buyNow(listingId, auth.user.id);
  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status });
  }

  return NextResponse.json({ ok: true, finalPrice: result.finalPrice });
}
