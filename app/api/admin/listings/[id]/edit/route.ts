import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import {
  getListingById,
  getPhotoFileNames,
  replaceListingPhotos,
  updateFixedPriceListing,
} from "@/lib/listings";
import { validateDescription, validatePrice, validateStockRemaining, validateTitle } from "@/lib/listingValidation";
import { MAX_PHOTO_COUNT } from "@/lib/photoLimits";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { deleteListingPhotoFiles, descriptionImageUrl, saveDescriptionImages, saveListingPhotos } from "@/lib/uploads";

type OrderEntry = { type: "existing"; fileName: string } | { type: "new"; index: number };

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

  const listing = await getListingById(listingId);
  if (!listing) {
    return NextResponse.json({ ok: false, error: "找不到這個商品" }, { status: 404 });
  }
  if (listing.listing_type !== "fixed_price") {
    return NextResponse.json({ ok: false, error: "這個商品不支援編輯" }, { status: 400 });
  }
  if (listing.status !== "open") {
    return NextResponse.json({ ok: false, error: "已下架的商品無法編輯" }, { status: 400 });
  }

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const price = Number(form.get("price"));
  const stockRemaining = Number(form.get("stockRemaining"));
  const newPhotos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  let order: OrderEntry[];
  try {
    order = JSON.parse(String(form.get("order") ?? "[]"));
    if (!Array.isArray(order)) throw new Error();
  } catch {
    return NextResponse.json({ ok: false, error: "照片順序資料不正確" }, { status: 400 });
  }

  const titleResult = validateTitle(title);
  if (!titleResult.ok) {
    return NextResponse.json({ ok: false, error: titleResult.error }, { status: 400 });
  }
  const descriptionResult = validateDescription(description);
  if (!descriptionResult.ok) {
    return NextResponse.json({ ok: false, error: descriptionResult.error }, { status: 400 });
  }
  const priceResult = validatePrice(price, "價格");
  if (!priceResult.ok) {
    return NextResponse.json({ ok: false, error: priceResult.error }, { status: 400 });
  }
  const stockResult = validateStockRemaining(stockRemaining);
  if (!stockResult.ok) {
    return NextResponse.json({ ok: false, error: stockResult.error }, { status: 400 });
  }
  if (order.length === 0) {
    return NextResponse.json({ ok: false, error: "至少需要一張照片" }, { status: 400 });
  }
  if (order.length > MAX_PHOTO_COUNT) {
    return NextResponse.json({ ok: false, error: `照片最多 ${MAX_PHOTO_COUNT} 張` }, { status: 400 });
  }
  if (descriptionImages.length > DESCRIPTION_IMAGE_MAX_COUNT) {
    return NextResponse.json({ ok: false, error: `描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張` }, { status: 400 });
  }

  const currentFileNames = await getPhotoFileNames(listingId);
  const currentFileNameSet = new Set(currentFileNames);
  for (const entry of order) {
    if (entry.type === "existing" && !currentFileNameSet.has(entry.fileName)) {
      return NextResponse.json({ ok: false, error: "照片資料不正確" }, { status: 400 });
    }
  }

  let savedFileNames: string[];
  let finalDescription: string;
  try {
    savedFileNames = await saveListingPhotos(listingId, newPhotos);
    const descriptionImageFileNames = await saveDescriptionImages(listingId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) => descriptionImageUrl(listingId, fileName));
    finalDescription = sanitizeDescriptionHtml(resolveDescriptionImagePlaceholders(description, descriptionImageUrls));
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const finalOrder = order.map((entry) => (entry.type === "existing" ? entry.fileName : savedFileNames[entry.index]));

  const result = await updateFixedPriceListing(listingId, { title, description: finalDescription, price, stockRemaining });
  if (!result.ok) {
    // Roll back the newly-saved files — the update was rejected (e.g. the
    // listing was cancelled by someone else between the check above and now).
    await deleteListingPhotoFiles(listingId, savedFileNames);
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await replaceListingPhotos(listingId, finalOrder);

  const removedFileNames = currentFileNames.filter((fileName) => !finalOrder.includes(fileName));
  await deleteListingPhotoFiles(listingId, removedFileNames);

  return NextResponse.json({ ok: true });
}
