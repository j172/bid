import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import { deletePigeonShowcase, getPigeonShowcaseById, updatePigeonShowcase, type PigeonShowcaseInput } from "@/lib/pigeonShowcase";
import {
  isPigeonShowcaseCategory,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
} from "@/lib/pigeonShowcaseValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  deletePigeonShowcaseImageFile,
  descriptionImageUrl,
  saveDescriptionImages,
  saveImageOrError,
  savePigeonShowcaseImage,
  withImageRollback,
} from "@/lib/uploads";
import { parseIdParam } from "@/lib/routeParams";

// Submits FormData (not JSON) as of issue #70 — unlike homepage_sections'
// PATCH route (image replacement optional, keeps the existing file when
// omitted), pigeon_showcase's 主圖 must be (re)selected on every edit too,
// per issue #70's explicit "新增／編輯時前後端都強制要求上傳" requirement —
// so this always saves a new file and always retires the old one.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const showcaseId = parseIdParam(id);
  if (showcaseId === null) {
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
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

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
  if (descriptionImages.length > DESCRIPTION_IMAGE_MAX_COUNT) {
    return NextResponse.json({ ok: false, error: `描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張` }, { status: 400 });
  }

  const saved = await saveImageOrError(() => savePigeonShowcaseImage(image));
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  }
  const imageFileName = saved.fileName;

  let finalDescription: string;
  try {
    const descriptionImageFileNames = await saveDescriptionImages("pigeon-showcase", showcaseId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) =>
      descriptionImageUrl("pigeon-showcase", showcaseId, fileName),
    );
    finalDescription = sanitizeDescriptionHtml(resolveDescriptionImagePlaceholders(description, descriptionImageUrls));
  } catch (error) {
    await deletePigeonShowcaseImageFile(imageFileName);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const input: PigeonShowcaseInput = {
    category,
    name,
    loftId,
    description: finalDescription,
    imageFileName,
  };
  const result = await withImageRollback(
    () => updatePigeonShowcase(showcaseId, input),
    () => deletePigeonShowcaseImageFile(imageFileName),
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (existing.imageFileName) {
    await deletePigeonShowcaseImageFile(existing.imageFileName);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const showcaseId = parseIdParam(id);
  if (showcaseId === null) {
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
