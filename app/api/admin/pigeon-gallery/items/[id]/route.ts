import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import {
  deletePigeonGalleryItem,
  getGalleryItemPhotoFileNames,
  getPigeonGalleryItemById,
  replaceGalleryItemPhotos,
  updatePigeonGalleryItem,
} from "@/lib/pigeonGallery";
import { validateOptionalDescription } from "@/lib/listingValidation";
import { MAX_PHOTO_COUNT } from "@/lib/photoLimits";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  deletePigeonGalleryItemImageFile,
  galleryItemDescriptionImageUrl,
  pigeonGalleryItemImageUrl,
  saveGalleryItemDescriptionImages,
  saveGalleryItemPhotos,
} from "@/lib/uploads";

const TITLE_MAX = 255;

type OrderEntry = { type: "existing"; fileName: string } | { type: "new"; index: number };

// Items created before issue #49 (or never re-edited since) have no
// gallery_item_photos rows at all — only the legacy single image_file_name.
// Synthesizing a one-photo list from it here means every caller (this GET,
// the PATCH below, DELETE) can treat "current photos" uniformly regardless
// of migration state, without a one-off backfill script.
async function currentPhotoFileNames(item: { id: number; imageFileName: string }): Promise<string[]> {
  const photos = await getGalleryItemPhotoFileNames(item.id);
  return photos.length > 0 ? photos : [item.imageFileName];
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ ok: false, error: "找不到這個展示鴿項目" }, { status: 404 });
  }

  const item = await getPigeonGalleryItemById(itemId);
  if (!item) {
    return NextResponse.json({ ok: false, error: "找不到這個展示鴿項目" }, { status: 404 });
  }

  const photoFileNames = await currentPhotoFileNames(item);
  return NextResponse.json({
    ok: true,
    item: {
      ...item,
      imageUrl: pigeonGalleryItemImageUrl(item.imageFileName),
      photos: photoFileNames.map((fileName) => ({ fileName, url: pigeonGalleryItemImageUrl(fileName) })),
    },
  });
}

// Multi-photo/description editing (issue #49) — same "send the complete
// desired final photo order, replace the whole set" pattern as
// app/api/admin/listings/[id]/edit/route.ts. categoryId stays non-editable
// here (unchanged from before this ticket).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ ok: false, error: "找不到這個展示鴿項目" }, { status: 404 });
  }

  const existing = await getPigeonGalleryItemById(itemId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個展示鴿項目" }, { status: 404 });
  }

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const loftIdRaw = String(form.get("loftId") ?? "").trim();
  const loftId = loftIdRaw === "" ? null : Number(loftIdRaw);
  const sortOrder = Number(form.get("sortOrder"));
  const isActiveRaw = String(form.get("isActive") ?? "true");
  const isActive = isActiveRaw === "true" || isActiveRaw === "1";
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

  if (!title || title.length > TITLE_MAX) {
    return NextResponse.json({ ok: false, error: `請輸入標題（上限 ${TITLE_MAX} 字）` }, { status: 400 });
  }
  const descriptionResult = validateOptionalDescription(description);
  if (!descriptionResult.ok) {
    return NextResponse.json({ ok: false, error: descriptionResult.error }, { status: 400 });
  }
  if (loftId !== null && (!Number.isFinite(loftId) || !Number.isInteger(loftId) || loftId <= 0)) {
    return NextResponse.json({ ok: false, error: "合作鴿舍不正確" }, { status: 400 });
  }
  if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
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

  const currentFileNames = await currentPhotoFileNames(existing);
  const currentFileNameSet = new Set(currentFileNames);
  for (const entry of order) {
    if (entry.type === "existing" && !currentFileNameSet.has(entry.fileName)) {
      return NextResponse.json({ ok: false, error: "照片資料不正確" }, { status: 400 });
    }
  }

  let savedFileNames: string[];
  let finalDescription: string;
  try {
    savedFileNames = await saveGalleryItemPhotos(newPhotos);
    const descriptionImageFileNames = await saveGalleryItemDescriptionImages(itemId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) => galleryItemDescriptionImageUrl(itemId, fileName));
    finalDescription = sanitizeDescriptionHtml(resolveDescriptionImagePlaceholders(description, descriptionImageUrls));
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const finalOrder = order.map((entry) => (entry.type === "existing" ? entry.fileName : savedFileNames[entry.index]));

  const result = await updatePigeonGalleryItem(itemId, {
    title,
    imageFileName: finalOrder[0],
    description: finalDescription,
    loftId,
    sortOrder,
    isActive,
  });
  if (!result.ok) {
    // Roll back the newly-saved files — the update was rejected (e.g. the
    // item was deleted by someone else between the check above and now).
    for (const fileName of savedFileNames) {
      await deletePigeonGalleryItemImageFile(fileName);
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  await replaceGalleryItemPhotos(itemId, finalOrder);

  const removedFileNames = currentFileNames.filter((fileName) => !finalOrder.includes(fileName));
  for (const fileName of removedFileNames) {
    await deletePigeonGalleryItemImageFile(fileName);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) {
    return NextResponse.json({ ok: false, error: "找不到這個展示鴿項目" }, { status: 404 });
  }

  const existing = await getPigeonGalleryItemById(itemId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個展示鴿項目" }, { status: 404 });
  }
  const fileNames = await currentPhotoFileNames(existing);

  const result = await deletePigeonGalleryItem(itemId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  for (const fileName of fileNames) {
    await deletePigeonGalleryItemImageFile(fileName);
  }
  return NextResponse.json({ ok: true });
}
