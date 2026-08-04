import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import {
  addGalleryItemPhotos,
  createPigeonGalleryItem,
  deletePigeonGalleryItem,
  listPigeonGalleryItems,
  updatePigeonGalleryItemImageAndDescription,
} from "@/lib/pigeonGallery";
import { validateOptionalDescription } from "@/lib/listingValidation";
import { MAX_PHOTO_COUNT } from "@/lib/photoLimits";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  galleryItemDescriptionImageUrl,
  pigeonGalleryItemImageUrl,
  saveGalleryItemDescriptionImages,
  saveGalleryItemPhotos,
} from "@/lib/uploads";

const TITLE_MAX = 255;

// Admin list view for a given category_id — includes inactive rows by
// default; pass ?activeOnly=1 for the same active-only view the public
// per-category gallery list page uses.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = Number(searchParams.get("categoryId"));
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "缺少 categoryId 參數" }, { status: 400 });
  }
  const activeOnly = searchParams.get("activeOnly") === "1";

  const items = await listPigeonGalleryItems(categoryId, { activeOnly });
  return NextResponse.json({
    ok: true,
    items: items.map((item) => ({ ...item, imageUrl: pigeonGalleryItemImageUrl(item.imageFileName) })),
  });
}

// Photos/description support (issue #49) mirrors app/api/admin/listings/
// route.ts's POST as closely as this table's shape allows: the item's own id
// (used to name its photo/description-image directories) only exists after
// insertion, so the row is created with empty image_file_name/description
// placeholders first, then backfilled once photos + description images are
// saved to disk — see updatePigeonGalleryItemImageAndDescription's comment.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const form = await request.formData();
  const categoryId = Number(form.get("categoryId"));
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const loftIdRaw = String(form.get("loftId") ?? "").trim();
  const loftId = loftIdRaw === "" ? null : Number(loftIdRaw);
  const sortOrderRaw = String(form.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw === "" ? undefined : Number(sortOrderRaw);
  const isActiveRaw = form.get("isActive");
  const isActive = isActiveRaw === null ? undefined : isActiveRaw === "true" || isActiveRaw === "1";
  const photos = form.getAll("photos").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "缺少 categoryId 參數" }, { status: 400 });
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
  if (sortOrder !== undefined && (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0)) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
  }
  if (photos.length === 0) {
    return NextResponse.json({ ok: false, error: "請至少上傳一張照片" }, { status: 400 });
  }
  if (photos.length > MAX_PHOTO_COUNT) {
    return NextResponse.json({ ok: false, error: `照片最多 ${MAX_PHOTO_COUNT} 張` }, { status: 400 });
  }
  if (descriptionImages.length > DESCRIPTION_IMAGE_MAX_COUNT) {
    return NextResponse.json({ ok: false, error: `描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張` }, { status: 400 });
  }

  const id = await createPigeonGalleryItem({
    categoryId,
    title,
    imageFileName: "",
    description: "",
    loftId,
    sortOrder,
    isActive,
  });

  try {
    const photoFileNames = await saveGalleryItemPhotos(photos);
    await addGalleryItemPhotos(id, photoFileNames);

    const descriptionImageFileNames = await saveGalleryItemDescriptionImages(id, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) => galleryItemDescriptionImageUrl(id, fileName));
    const resolvedDescription = resolveDescriptionImagePlaceholders(description, descriptionImageUrls);
    await updatePigeonGalleryItemImageAndDescription(id, photoFileNames[0], sanitizeDescriptionHtml(resolvedDescription));
  } catch (error) {
    await deletePigeonGalleryItem(id);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id });
}
