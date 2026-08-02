import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  deletePigeonGalleryCategory,
  getPigeonGalleryCategoryById,
  updatePigeonGalleryCategory,
} from "@/lib/pigeonGallery";
import {
  deletePigeonGalleryCategoryImageFile,
  pigeonGalleryCategoryImageUrl,
  savePigeonGalleryCategoryImage,
} from "@/lib/uploads";

const NAME_MAX = 100;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "找不到這個鴿舍分類" }, { status: 404 });
  }

  const category = await getPigeonGalleryCategoryById(categoryId);
  if (!category) {
    return NextResponse.json({ ok: false, error: "找不到這個鴿舍分類" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    category: { ...category, coverImageUrl: pigeonGalleryCategoryImageUrl(category.coverImageFileName) },
  });
}

// Cover image replacement is optional — same "only replace what's sent"
// pattern as app/api/admin/homepage-sections/[id]/route.ts's PATCH.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "找不到這個鴿舍分類" }, { status: 404 });
  }

  const existing = await getPigeonGalleryCategoryById(categoryId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個鴿舍分類" }, { status: 404 });
  }

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const sortOrder = Number(form.get("sortOrder"));
  const isActiveRaw = String(form.get("isActive") ?? "true");
  const isActive = isActiveRaw === "true" || isActiveRaw === "1";
  const newImage = form.get("image");

  if (!name || name.length > NAME_MAX) {
    return NextResponse.json({ ok: false, error: `請輸入分類名稱（上限 ${NAME_MAX} 字）` }, { status: 400 });
  }
  if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
  }

  let coverImageFileName = existing.coverImageFileName;
  if (newImage instanceof File && newImage.size > 0) {
    try {
      coverImageFileName = await savePigeonGalleryCategoryImage(newImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "圖片上傳失敗";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  const result = await updatePigeonGalleryCategory(categoryId, { name, coverImageFileName, sortOrder, isActive });
  if (!result.ok) {
    if (coverImageFileName !== existing.coverImageFileName) {
      await deletePigeonGalleryCategoryImageFile(coverImageFileName);
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (coverImageFileName !== existing.coverImageFileName) {
    await deletePigeonGalleryCategoryImageFile(existing.coverImageFileName);
  }
  return NextResponse.json({ ok: true });
}

// Also removes every item in this category (see deletePigeonGalleryCategory's
// comment — there's no DB-level cascade in this project) along with their
// image files, plus the category's own cover image.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ ok: false, error: "找不到這個鴿舍分類" }, { status: 404 });
  }

  const existing = await getPigeonGalleryCategoryById(categoryId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個鴿舍分類" }, { status: 404 });
  }

  const result = await deletePigeonGalleryCategory(categoryId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  await deletePigeonGalleryCategoryImageFile(existing.coverImageFileName);
  return NextResponse.json({ ok: true });
}
