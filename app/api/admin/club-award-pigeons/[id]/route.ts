import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import {
  deleteClubAwardPigeon,
  getClubAwardPigeonById,
  updateClubAwardPigeon,
  type ClubAwardPigeonInput,
} from "@/lib/clubAwardPigeons";
import {
  isPigeonShowcaseCategory,
  parseOptionalClubAwardSortOrder,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
  validatePigeonShowcasePhotoSource,
} from "@/lib/clubAwardPigeonsValidation";
import { parseIdParam } from "@/lib/routeParams";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  deleteClubAwardPigeonImageFile,
  descriptionImageUrl,
  saveClubAwardPigeonImage,
  saveDescriptionImages,
  saveImageOrError,
  withImageRollback,
} from "@/lib/uploads";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const pigeonId = parseIdParam(id);
  if (pigeonId === null) {
    return NextResponse.json({ ok: false, error: "找不到這筆入賞鴿資料" }, { status: 404 });
  }

  const existing = await getClubAwardPigeonById(pigeonId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這筆入賞鴿資料" }, { status: 404 });
  }

  const form = await request.formData();
  const albumIdRaw = form.get("albumId");
  const albumIdNum = Number(albumIdRaw);
  const albumId = Number.isFinite(albumIdNum) && Number.isInteger(albumIdNum) && albumIdNum > 0 ? albumIdNum : null;
  const sortOrderRaw = form.get("sortOrder");
  const sortOrder = sortOrderRaw === null ? undefined : parseOptionalClubAwardSortOrder(sortOrderRaw);
  const category = form.get("category");
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const loftIdRaw = form.get("loftId");
  const loftIdNum = Number(loftIdRaw);
  const loftId = Number.isFinite(loftIdNum) && Number.isInteger(loftIdNum) && loftIdNum > 0 ? loftIdNum : null;
  const photoSourceRaw = form.get("photoSource");
  const photoSource = typeof photoSourceRaw === "string" ? photoSourceRaw.trim() || null : null;
  const image = form.get("image");
  const descriptionImages = form
    .getAll("descriptionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (albumId === null) {
    return NextResponse.json({ ok: false, error: "請選擇相簿名稱" }, { status: 400 });
  }
  if (sortOrder === null) {
    return NextResponse.json({ ok: false, error: "排序值必須是大於或等於 0 的整數" }, { status: 400 });
  }
  if (!isPigeonShowcaseCategory(category)) {
    return NextResponse.json({ ok: false, error: "請選擇鴿種" }, { status: 400 });
  }
  const nameResult = validatePigeonShowcaseName(name);
  if (!nameResult.ok) {
    return NextResponse.json({ ok: false, error: nameResult.error }, { status: 400 });
  }
  if (photoSource !== null) {
    const photoSourceResult = validatePigeonShowcasePhotoSource(photoSource);
    if (!photoSourceResult.ok) {
      return NextResponse.json({ ok: false, error: photoSourceResult.error }, { status: 400 });
    }
  }
  const descriptionResult = validatePigeonShowcaseDescription(description);
  if (!descriptionResult.ok) {
    return NextResponse.json({ ok: false, error: descriptionResult.error }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "請上傳主圖" }, { status: 400 });
  }
  if (descriptionImages.length > DESCRIPTION_IMAGE_MAX_COUNT) {
    return NextResponse.json({ ok: false, error: `描述圖片最多 ${DESCRIPTION_IMAGE_MAX_COUNT} 張` }, { status: 400 });
  }

  const saved = await saveImageOrError(() => saveClubAwardPigeonImage(image));
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  }
  const imageFileName = saved.fileName;

  let finalDescription: string;
  try {
    const descriptionImageFileNames = await saveDescriptionImages("club-award-pigeons", pigeonId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) =>
      descriptionImageUrl("club-award-pigeons", pigeonId, fileName),
    );
    finalDescription = sanitizeDescriptionHtml(
      resolveDescriptionImagePlaceholders(description, descriptionImageUrls),
    );
  } catch (error) {
    await deleteClubAwardPigeonImageFile(imageFileName);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const input: ClubAwardPigeonInput = {
    albumId,
    ...(sortOrder === undefined ? {} : { sortOrder }),
    category,
    name,
    loftId,
    photoSource,
    description: finalDescription,
    imageFileName,
  };
  const result = await withImageRollback(
    () => updateClubAwardPigeon(pigeonId, input),
    () => deleteClubAwardPigeonImageFile(imageFileName),
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (existing.imageFileName) {
    await deleteClubAwardPigeonImageFile(existing.imageFileName);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const pigeonId = parseIdParam(id);
  if (pigeonId === null) {
    return NextResponse.json({ ok: false, error: "找不到這筆入賞鴿資料" }, { status: 404 });
  }

  const existing = await getClubAwardPigeonById(pigeonId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這筆入賞鴿資料" }, { status: 404 });
  }

  const result = await deleteClubAwardPigeon(pigeonId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  if (existing.imageFileName) {
    await deleteClubAwardPigeonImageFile(existing.imageFileName);
  }
  return NextResponse.json({ ok: true });
}
