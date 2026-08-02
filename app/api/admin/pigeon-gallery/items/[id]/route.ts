import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validatePrice } from "@/lib/listingValidation";
import { deletePigeonGalleryItem, getPigeonGalleryItemById, updatePigeonGalleryItem, type GalleryPriceType } from "@/lib/pigeonGallery";
import { deletePigeonGalleryItemImageFile, pigeonGalleryItemImageUrl, savePigeonGalleryItemImage } from "@/lib/uploads";

const TITLE_MAX = 255;
const PRICE_TYPES: GalleryPriceType[] = ["auction", "fixed_price"];

function isPriceType(value: string): value is GalleryPriceType {
  return (PRICE_TYPES as string[]).includes(value);
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

  return NextResponse.json({ ok: true, item: { ...item, imageUrl: pigeonGalleryItemImageUrl(item.imageFileName) } });
}

// Image replacement is optional — same "only replace what's sent" pattern
// as app/api/admin/homepage-sections/[id]/route.ts's PATCH. categoryId is
// deliberately not editable here (moving an item between categories isn't
// part of this ticket's scope — delete and recreate under the new category
// instead).
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
  const priceType = String(form.get("priceType") ?? "");
  const referencePrice = Number(form.get("referencePrice"));
  const sortOrder = Number(form.get("sortOrder"));
  const isActiveRaw = String(form.get("isActive") ?? "true");
  const isActive = isActiveRaw === "true" || isActiveRaw === "1";
  const newImage = form.get("image");

  if (!title || title.length > TITLE_MAX) {
    return NextResponse.json({ ok: false, error: `請輸入標題（上限 ${TITLE_MAX} 字）` }, { status: 400 });
  }
  if (!isPriceType(priceType)) {
    return NextResponse.json({ ok: false, error: "priceType 必須是 auction 或 fixed_price" }, { status: 400 });
  }
  const priceResult = validatePrice(referencePrice, "參考價格");
  if (!priceResult.ok) {
    return NextResponse.json({ ok: false, error: priceResult.error }, { status: 400 });
  }
  if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
  }

  let imageFileName = existing.imageFileName;
  if (newImage instanceof File && newImage.size > 0) {
    try {
      imageFileName = await savePigeonGalleryItemImage(newImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "圖片上傳失敗";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  const result = await updatePigeonGalleryItem(itemId, { title, imageFileName, priceType, referencePrice, sortOrder, isActive });
  if (!result.ok) {
    if (imageFileName !== existing.imageFileName) {
      await deletePigeonGalleryItemImageFile(imageFileName);
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (imageFileName !== existing.imageFileName) {
    await deletePigeonGalleryItemImageFile(existing.imageFileName);
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

  const result = await deletePigeonGalleryItem(itemId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  await deletePigeonGalleryItemImageFile(existing.imageFileName);
  return NextResponse.json({ ok: true });
}
