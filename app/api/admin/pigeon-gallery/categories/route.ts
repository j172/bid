import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createPigeonGalleryCategory, listPigeonGalleryCategories, type GalleryType } from "@/lib/pigeonGallery";
import { pigeonGalleryCategoryImageUrl, savePigeonGalleryCategoryImage } from "@/lib/uploads";

const NAME_MAX = 100;
const GALLERY_TYPES: GalleryType[] = ["award", "import"];

function isGalleryType(value: string): value is GalleryType {
  return (GALLERY_TYPES as string[]).includes(value);
}

// Admin list view for a given gallery_type ('award' 入賞鴿 | 'import' 進口鴿)
// — includes inactive rows by default; pass ?activeOnly=1 for the same
// active-only view the public gallery landing page uses.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const galleryType = searchParams.get("galleryType") ?? "";
  if (!isGalleryType(galleryType)) {
    return NextResponse.json({ ok: false, error: "galleryType 必須是 award 或 import" }, { status: 400 });
  }
  const activeOnly = searchParams.get("activeOnly") === "1";

  const categories = await listPigeonGalleryCategories(galleryType, { activeOnly });
  return NextResponse.json({
    ok: true,
    categories: categories.map((category) => ({
      ...category,
      coverImageUrl: pigeonGalleryCategoryImageUrl(category.coverImageFileName),
    })),
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
  const galleryType = String(form.get("galleryType") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const sortOrderRaw = String(form.get("sortOrder") ?? "").trim();
  const sortOrder = sortOrderRaw === "" ? undefined : Number(sortOrderRaw);
  const isActiveRaw = form.get("isActive");
  const isActive = isActiveRaw === null ? undefined : isActiveRaw === "true" || isActiveRaw === "1";
  const image = form.get("image");

  if (!isGalleryType(galleryType)) {
    return NextResponse.json({ ok: false, error: "galleryType 必須是 award 或 import" }, { status: 400 });
  }
  if (!name || name.length > NAME_MAX) {
    return NextResponse.json({ ok: false, error: `請輸入分類名稱（上限 ${NAME_MAX} 字）` }, { status: 400 });
  }
  if (sortOrder !== undefined && (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0)) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "請上傳封面圖片" }, { status: 400 });
  }

  let coverImageFileName: string;
  try {
    coverImageFileName = await savePigeonGalleryCategoryImage(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const id = await createPigeonGalleryCategory({ galleryType, name, coverImageFileName, sortOrder, isActive });
  return NextResponse.json({ ok: true, id });
}
