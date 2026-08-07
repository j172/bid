import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deletePigeonShowcase, getPigeonShowcaseById, updatePigeonShowcase, type PigeonShowcaseInput } from "@/lib/pigeonShowcase";
import {
  isPigeonShowcaseCategory,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
} from "@/lib/pigeonShowcaseValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { deletePigeonShowcaseImageFile, savePigeonShowcaseImage } from "@/lib/uploads";

// Submits FormData (not JSON) as of issue #70 — unlike homepage_sections'
// PATCH route (image replacement optional, keeps the existing file when
// omitted), pigeon_showcase's 主圖 must be (re)selected on every edit too,
// per issue #70's explicit "新增／編輯時前後端都強制要求上傳" requirement —
// so this always saves a new file and always retires the old one.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const showcaseId = Number(id);
  if (!Number.isFinite(showcaseId)) {
    return NextResponse.json({ ok: false, error: "找不到這筆鴿況資料" }, { status: 404 });
  }

  const existing = await getPigeonShowcaseById(showcaseId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這筆鴿況資料" }, { status: 404 });
  }

  const form = await request.formData();
  const category = form.get("category");
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const loftId = Number(form.get("loftId"));
  const image = form.get("image");

  if (!isPigeonShowcaseCategory(category)) {
    return NextResponse.json({ ok: false, error: "請選擇鴿種" }, { status: 400 });
  }
  const nameResult = validatePigeonShowcaseName(name);
  if (!nameResult.ok) {
    return NextResponse.json({ ok: false, error: nameResult.error }, { status: 400 });
  }
  const descriptionResult = validatePigeonShowcaseDescription(description);
  if (!descriptionResult.ok) {
    return NextResponse.json({ ok: false, error: descriptionResult.error }, { status: 400 });
  }
  if (!Number.isFinite(loftId) || !Number.isInteger(loftId) || loftId <= 0) {
    return NextResponse.json({ ok: false, error: "請選擇鴿舍" }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "請上傳主圖" }, { status: 400 });
  }

  let imageFileName: string;
  try {
    imageFileName = await savePigeonShowcaseImage(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const input: PigeonShowcaseInput = {
    category,
    name,
    loftId,
    description: sanitizeDescriptionHtml(description),
    imageFileName,
  };
  const result = await updatePigeonShowcase(showcaseId, input);
  if (!result.ok) {
    await deletePigeonShowcaseImageFile(imageFileName);
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (existing.imageFileName) {
    await deletePigeonShowcaseImageFile(existing.imageFileName);
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
  const showcaseId = Number(id);
  if (!Number.isFinite(showcaseId)) {
    return NextResponse.json({ ok: false, error: "找不到這筆鴿況資料" }, { status: 404 });
  }

  const existing = await getPigeonShowcaseById(showcaseId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這筆鴿況資料" }, { status: 404 });
  }

  const result = await deletePigeonShowcase(showcaseId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  if (existing.imageFileName) {
    await deletePigeonShowcaseImageFile(existing.imageFileName);
  }
  return NextResponse.json({ ok: true });
}
