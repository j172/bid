import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validatePrice } from "@/lib/listingValidation";
import { createPigeonGalleryItem, listPigeonGalleryItems, type GalleryPriceType } from "@/lib/pigeonGallery";
import { pigeonGalleryItemImageUrl, savePigeonGalleryItemImage } from "@/lib/uploads";

const TITLE_MAX = 255;
const PRICE_TYPES: GalleryPriceType[] = ["auction", "fixed_price"];

function isPriceType(value: string): value is GalleryPriceType {
  return (PRICE_TYPES as string[]).includes(value);
}

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
  const priceType = String(form.get("priceType") ?? "");
  const referencePrice = Number(form.get("referencePrice"));
  const sortOrderRaw = String(form.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw === "" ? undefined : Number(sortOrderRaw);
  const isActiveRaw = form.get("isActive");
  const isActive = isActiveRaw === null ? undefined : isActiveRaw === "true" || isActiveRaw === "1";
  const image = form.get("image");

  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "缺少 categoryId 參數" }, { status: 400 });
  }
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
  if (sortOrder !== undefined && (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0)) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "請上傳圖片" }, { status: 400 });
  }

  let imageFileName: string;
  try {
    imageFileName = await savePigeonGalleryItemImage(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const id = await createPigeonGalleryItem({
    categoryId,
    title,
    imageFileName,
    priceType,
    referencePrice,
    sortOrder,
    isActive,
  });
  return NextResponse.json({ ok: true, id });
}
