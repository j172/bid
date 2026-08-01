import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import { addListingPhotos, deleteListing, insertListing, updateListingDescription, type NewListingInput } from "@/lib/listings";
import { validateDescription, validateEndsAt, validatePrice, validateStockQuantity, validateTitle } from "@/lib/listingValidation";
import { MAX_PHOTO_COUNT } from "@/lib/photoLimits";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { descriptionImageUrl, saveDescriptionImages, saveListingPhotos } from "@/lib/uploads";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const form = await request.formData();
  const listingType = form.get("listingType") === "fixed_price" ? "fixed_price" : "auction";
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const photos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const titleResult = validateTitle(title);
  if (!titleResult.ok) {
    return NextResponse.json({ ok: false, error: titleResult.error }, { status: 400 });
  }
  const descriptionResult = validateDescription(description);
  if (!descriptionResult.ok) {
    return NextResponse.json({ ok: false, error: descriptionResult.error }, { status: 400 });
  }
  if (photos.length === 0) {
    return NextResponse.json({ ok: false, error: "至少需要上傳一張照片" }, { status: 400 });
  }
  if (photos.length > MAX_PHOTO_COUNT) {
    return NextResponse.json({ ok: false, error: `照片最多 ${MAX_PHOTO_COUNT} 張` }, { status: 400 });
  }
  if (descriptionImages.length > DESCRIPTION_IMAGE_MAX_COUNT) {
    return NextResponse.json({ ok: false, error: `描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張` }, { status: 400 });
  }

  let input: NewListingInput;

  if (listingType === "fixed_price") {
    const price = Number(form.get("price"));
    const stockQuantity = Number(form.get("stockQuantity"));

    const priceResult = validatePrice(price, "價格");
    if (!priceResult.ok) {
      return NextResponse.json({ ok: false, error: priceResult.error }, { status: 400 });
    }
    const stockResult = validateStockQuantity(stockQuantity);
    if (!stockResult.ok) {
      return NextResponse.json({ ok: false, error: stockResult.error }, { status: 400 });
    }

    // description is filled in after insertListing, once its final HTML
    // (with description-image placeholders resolved and the whole thing
    // sanitized) is ready — see the comment below insertListing.
    input = { listingType, title, description: "", price, stockQuantity, createdBy: user.id };
  } else {
    const startingPrice = Number(form.get("startingPrice"));
    const buyItNowPriceRaw = String(form.get("buyItNowPrice") ?? "").trim();
    const buyItNowPrice = buyItNowPriceRaw === "" ? null : Number(buyItNowPriceRaw);
    const endsAtRaw = String(form.get("endsAt") ?? "");
    const endsAt = new Date(endsAtRaw);

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

    input = { listingType, title, description: "", startingPrice, buyItNowPrice, endsAt, createdBy: user.id };
  }

  // The listing's own id names its photo/description-image directories, so
  // it has to exist before any files are saved — hence description is
  // inserted empty above and only backfilled (sanitized, with its `cid:N`
  // image placeholders resolved to real URLs) once that's done.
  const listingId = await insertListing(input);

  try {
    const fileNames = await saveListingPhotos(listingId, photos);
    await addListingPhotos(listingId, fileNames);

    const descriptionImageFileNames = await saveDescriptionImages(listingId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) => descriptionImageUrl(listingId, fileName));
    const resolvedDescription = resolveDescriptionImagePlaceholders(description, descriptionImageUrls);
    await updateListingDescription(listingId, sanitizeDescriptionHtml(resolvedDescription));
  } catch (error) {
    await deleteListing(listingId);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: listingId });
}
