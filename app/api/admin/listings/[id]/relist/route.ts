import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addListingPhotos, relistClosedListing } from "@/lib/listings";
import { validateEndsAt, validatePrice } from "@/lib/listingValidation";
import { copyListingPhotos } from "@/lib/uploads";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const startingPrice = Number(body?.startingPrice);
  const buyItNowPriceRaw = body?.buyItNowPrice;
  const buyItNowPrice = buyItNowPriceRaw === null || buyItNowPriceRaw === undefined || buyItNowPriceRaw === "" ? null : Number(buyItNowPriceRaw);
  const endsAt = new Date(String(body?.endsAt ?? ""));

  const startingPriceResult = validatePrice(startingPrice, "起標價");
  if (!startingPriceResult.ok) {
    return NextResponse.json({ ok: false, error: startingPriceResult.error }, { status: 400 });
  }
  if (buyItNowPrice !== null) {
    const buyItNowResult = validatePrice(buyItNowPrice, "買斷價");
    if (!buyItNowResult.ok) {
      return NextResponse.json({ ok: false, error: buyItNowResult.error }, { status: 400 });
    }
    if (buyItNowPrice <= startingPrice) {
      return NextResponse.json({ ok: false, error: "買斷價必須大於起標價" }, { status: 400 });
    }
  }
  const endsAtResult = validateEndsAt(endsAt);
  if (!endsAtResult.ok) {
    return NextResponse.json({ ok: false, error: endsAtResult.error }, { status: 400 });
  }

  const result = await relistClosedListing(listingId, { startingPrice, buyItNowPrice, endsAt });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (result.photoFileNames.length > 0) {
    await copyListingPhotos(listingId, result.newListingId, result.photoFileNames);
    await addListingPhotos(result.newListingId, result.photoFileNames);
  }

  return NextResponse.json({ ok: true, id: result.newListingId });
}
