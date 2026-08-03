import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteHomepageSection, getHomepageSectionById, updateHomepageSection } from "@/lib/homepageSections";
import { deleteHomepageSectionImageFile, homepageSectionImageUrl, saveHomepageSectionImage } from "@/lib/uploads";

const TITLE_MAX = 255;
const BIO_MAX = 2000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const sectionId = Number(id);
  if (!Number.isFinite(sectionId)) {
    return NextResponse.json({ ok: false, error: "找不到這個首頁區塊項目" }, { status: 404 });
  }

  const section = await getHomepageSectionById(sectionId);
  if (!section) {
    return NextResponse.json({ ok: false, error: "找不到這個首頁區塊項目" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, section: { ...section, imageUrl: homepageSectionImageUrl(section.imageFileName) } });
}

// Image replacement is optional — omitting the `image` field keeps the
// existing image_file_name untouched (same "only replace what's sent"
// pattern as the listing edit route, see app/api/admin/listings/[id]/edit).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const sectionId = Number(id);
  if (!Number.isFinite(sectionId)) {
    return NextResponse.json({ ok: false, error: "找不到這個首頁區塊項目" }, { status: 404 });
  }

  const existing = await getHomepageSectionById(sectionId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個首頁區塊項目" }, { status: 404 });
  }

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const bioRaw = String(form.get("bio") ?? "").trim();
  const bio = bioRaw === "" ? null : bioRaw;
  const sortOrder = Number(form.get("sortOrder"));
  const isActiveRaw = String(form.get("isActive") ?? "true");
  const isActive = isActiveRaw === "true" || isActiveRaw === "1";
  const newImage = form.get("image");

  if (!title || title.length > TITLE_MAX) {
    return NextResponse.json({ ok: false, error: `請輸入標題（上限 ${TITLE_MAX} 字）` }, { status: 400 });
  }
  if (bio !== null && bio.length > BIO_MAX) {
    return NextResponse.json({ ok: false, error: `簡介上限 ${BIO_MAX} 字` }, { status: 400 });
  }
  if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
  }

  let imageFileName = existing.imageFileName;
  if (newImage instanceof File && newImage.size > 0) {
    try {
      imageFileName = await saveHomepageSectionImage(newImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "圖片上傳失敗";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  const result = await updateHomepageSection(sectionId, { title, bio, sortOrder, isActive, imageFileName });
  if (!result.ok) {
    if (imageFileName !== existing.imageFileName) {
      await deleteHomepageSectionImageFile(imageFileName);
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (imageFileName !== existing.imageFileName) {
    await deleteHomepageSectionImageFile(existing.imageFileName);
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
  const sectionId = Number(id);
  if (!Number.isFinite(sectionId)) {
    return NextResponse.json({ ok: false, error: "找不到這個首頁區塊項目" }, { status: 404 });
  }

  const existing = await getHomepageSectionById(sectionId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個首頁區塊項目" }, { status: 404 });
  }

  const result = await deleteHomepageSection(sectionId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  await deleteHomepageSectionImageFile(existing.imageFileName);
  return NextResponse.json({ ok: true });
}
