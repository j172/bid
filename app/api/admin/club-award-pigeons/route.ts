import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import {
  createClubAwardPigeon,
  deleteClubAwardPigeon,
  isClubAwardPageSize,
  listClubAwardPigeons,
  updateClubAwardPigeonDescription,
  type ClubAwardPigeonInput,
} from "@/lib/clubAwardPigeons";
import {
  isPigeonShowcaseCategory,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
  validatePigeonShowcasePhotoSource,
} from "@/lib/clubAwardPigeonsValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  deleteClubAwardPigeonImageFile,
  descriptionImageUrl,
  saveClubAwardPigeonImage,
  saveDescriptionImages,
  saveImageOrError,
  withImageRollback,
} from "@/lib/uploads";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const albumIdRaw = searchParams.get("albumId");
  const albumId = albumIdRaw && Number.isFinite(Number(albumIdRaw)) && Number(albumIdRaw) > 0 ? Number(albumIdRaw) : undefined;
  const categoryRaw = searchParams.get("category") ?? "";
  const category = isPigeonShowcaseCategory(categoryRaw) ? categoryRaw : undefined;
  const search = searchParams.get("search")?.trim() || undefined;
  const loftIdRaw = searchParams.get("loftId");
  const loftId = loftIdRaw && Number.isFinite(Number(loftIdRaw)) && Number(loftIdRaw) > 0 ? Number(loftIdRaw) : undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const pageSize = isClubAwardPageSize(pageSizeRaw) ? pageSizeRaw : undefined;

  const { items, total } = await listClubAwardPigeons({ albumId, category, search, loftId, page, pageSize });
  return NextResponse.json({ ok: true, items, total });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const form = await request.formData();
  const albumIdRaw = form.get("albumId");
  const albumIdNum = Number(albumIdRaw);
  const albumId = Number.isFinite(albumIdNum) && Number.isInteger(albumIdNum) && albumIdNum > 0 ? albumIdNum : null;
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

  const input: ClubAwardPigeonInput = {
    albumId,
    category,
    name,
    loftId,
    photoSource,
    description: "",
    imageFileName,
  };
  const result = await withImageRollback(
    () => createClubAwardPigeon(input),
    () => deleteClubAwardPigeonImageFile(imageFileName),
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  const pigeonId = result.id as number;

  try {
    const descriptionImageFileNames = await saveDescriptionImages("club-award-pigeons", pigeonId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) =>
      descriptionImageUrl("club-award-pigeons", pigeonId, fileName),
    );
    const finalDescription = sanitizeDescriptionHtml(
      resolveDescriptionImagePlaceholders(description, descriptionImageUrls),
    );
    await updateClubAwardPigeonDescription(pigeonId, finalDescription);
  } catch (error) {
    await deleteClubAwardPigeon(pigeonId);
    await deleteClubAwardPigeonImageFile(imageFileName);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: pigeonId });
}
