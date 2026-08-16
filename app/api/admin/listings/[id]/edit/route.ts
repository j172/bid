import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import { parsePhotoOrder, resolvePhotoOrder, type PhotoOrderEntry } from "@/lib/listingPhotoOrder";
import {
  getListingById,
  getPhotoFileNames,
  replaceListingPhotos,
  updateFixedPriceListing,
} from "@/lib/listings";
import { validateDescription, validateLoftId, validatePrice, validateStockRemaining, validateTitle } from "@/lib/listingValidation";
import { MAX_PHOTO_COUNT } from "@/lib/photoLimits";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { deleteListingPhotoFiles, descriptionImageUrl, saveDescriptionImages, saveListingPhotos } from "@/lib/uploads";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const listingId = parseIdParam(id);
  if (listingId === null) {
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
  const loftIdRaw = String(form.get("loftId") ?? "").trim();
  const loftId = loftIdRaw === "" ? null : Number(loftIdRaw);
  const newPhotos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  // Shape-validated up front (issue #139 M3): an entry whose `type` is
  // neither "existing" nor "new", or a "new" entry without a usable index,
  // is rejected here rather than silently resolving to `undefined` later.
  const order: PhotoOrderEntry[] | null = parsePhotoOrder(String(form.get("order") ?? "[]"));
  if (order === null) {
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
  const loftIdResult = validateLoftId(loftId);
  if (!loftIdResult.ok) {
    return NextResponse.json({ ok: false, error: loftIdResult.error }, { status: 400 });
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

  // Cross-checks the order against reality, now that both sides are known:
  // every "existing" entry must still be one of this listing's photos, and
  // every "new" entry must point at a file this request actually saved. A
  // mismatch used to write `undefined` into listing_photos (issue #139 M3).
  const finalOrder = resolvePhotoOrder(order, currentFileNames, savedFileNames);
  if (finalOrder === null) {
    await deleteListingPhotoFiles(listingId, savedFileNames);
    return NextResponse.json({ ok: false, error: "照片資料不正確" }, { status: 400 });
  }

  const result = await updateFixedPriceListing(listingId, { title, description: finalDescription, price, stockRemaining, loftId });
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
