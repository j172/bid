import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addListingPhotos, deleteListing, insertListing } from "@/lib/listings";
import { saveListingPhotos } from "@/lib/uploads";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const startingPrice = Number(form.get("startingPrice"));
  const buyItNowPriceRaw = String(form.get("buyItNowPrice") ?? "").trim();
  const buyItNowPrice = buyItNowPriceRaw === "" ? null : Number(buyItNowPriceRaw);
  const endsAtRaw = String(form.get("endsAt") ?? "");
  const photos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!title) {
    return NextResponse.json({ ok: false, error: "請輸入標題" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ ok: false, error: "請輸入描述" }, { status: 400 });
  }
  if (!Number.isFinite(startingPrice) || startingPrice <= 0) {
    return NextResponse.json({ ok: false, error: "起標價必須是正數" }, { status: 400 });
  }
  if (buyItNowPrice !== null && (!Number.isFinite(buyItNowPrice) || buyItNowPrice <= startingPrice)) {
    return NextResponse.json({ ok: false, error: "買斷價必須大於起標價" }, { status: 400 });
  }
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: "結標時間必須是有效且在未來的時間" }, { status: 400 });
  }
  if (photos.length === 0) {
    return NextResponse.json({ ok: false, error: "至少需要上傳一張照片" }, { status: 400 });
  }

  const listingId = await insertListing({
    title,
    description,
    startingPrice,
    buyItNowPrice,
    endsAt,
    createdBy: user.id,
  });

  try {
    const fileNames = await saveListingPhotos(listingId, photos);
    await addListingPhotos(listingId, fileNames);
  } catch (error) {
    await deleteListing(listingId);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: listingId });
}
