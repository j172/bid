import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reorderPigeonGalleryCategories, type GalleryType } from "@/lib/pigeonGallery";

const GALLERY_TYPES: GalleryType[] = ["award", "import"];

function isGalleryType(value: string): value is GalleryType {
  return (GALLERY_TYPES as string[]).includes(value);
}

// Bulk re-sequence: body is { galleryType, orderedIds: number[] } — see
// reorderHomepageSections' comment (lib/homepageSections.ts) for why this is
// a single atomic call rather than one PATCH per row.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const galleryType = typeof body?.galleryType === "string" ? body.galleryType : "";
  const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : null;

  if (!isGalleryType(galleryType)) {
    return NextResponse.json({ ok: false, error: "galleryType 必須是 award 或 import" }, { status: 400 });
  }
  if (!orderedIds || !orderedIds.every((id: unknown) => typeof id === "number" && Number.isFinite(id))) {
    return NextResponse.json({ ok: false, error: "排序資料不正確" }, { status: 400 });
  }

  const result = await reorderPigeonGalleryCategories(galleryType, orderedIds);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
