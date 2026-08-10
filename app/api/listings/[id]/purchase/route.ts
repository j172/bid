import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { purchaseListing } from "@/lib/listings";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { id } = await params;
  const listingId = parseIdParam(id);
  if (listingId === null) {
    return NextResponse.json({ ok: false, errorCode: "NOT_FOUND" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const quantity = Number(body?.quantity);

  const result = await purchaseListing(listingId, auth.user.id, quantity);
  if (!result.ok) {
    const status = result.errorCode === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status });
  }

  return NextResponse.json({ ok: true });
}
