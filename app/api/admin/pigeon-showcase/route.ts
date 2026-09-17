import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { DESCRIPTION_IMAGE_MAX_COUNT } from "@/lib/descriptionImageLimits";
import { resolveDescriptionImagePlaceholders } from "@/lib/descriptionImages";
import {
  createPigeonShowcase,
  deletePigeonShowcase,
  isPigeonShowcasePageSize,
  listPigeonShowcase,
  updatePigeonShowcaseDescription,
  type PigeonShowcaseInput,
} from "@/lib/pigeonShowcase";
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

// Admin list view — matches the filters issue #54 asks for: category
// dropdown, name substring search, loft dropdown, selectable page size
// (30/50/100). No JOIN-only public equivalent lives here; the public
// category list page (app/[locale]/pigeon-showcase/page.tsx) calls
// listPigeonShowcase directly (server component), same as every other
// public page in this app reading straight from lib/*.ts.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const categoryRaw = searchParams.get("category") ?? "";
  const category = isPigeonShowcaseCategory(categoryRaw) ? categoryRaw : undefined;
  const search = searchParams.get("search")?.trim() || undefined;
  const loftIdRaw = searchParams.get("loftId");
  const loftId = loftIdRaw && Number.isFinite(Number(loftIdRaw)) ? Number(loftIdRaw) : undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const pageSize = isPigeonShowcasePageSize(pageSizeRaw) ? pageSizeRaw : undefined;

  const { items, total } = await listPigeonShowcase({ category, search, loftId, page, pageSize });
  return NextResponse.json({ ok: true, items, total });
}

// Submits FormData (not JSON) as of issue #70 — 主圖 upload is required on
// every create, front and back end both (see PigeonShowcaseFormModal.tsx).
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

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

  // description is inserted empty and only backfilled (sanitized, with its
  // `cid:N` image placeholders resolved to real URLs) once the row's id
  // exists — its description images are stored under
  // uploads/pigeon-showcase/<id>/description/ (see lib/uploads.ts's
  // saveDescriptionImages), same two-phase sequencing as
  // app/api/admin/listings/route.ts (issue #315).
  const input: PigeonShowcaseInput = {
    category,
    name,
    loftId,
    description: "",
    imageFileName,
  };
  // Rollback: if the row was never created, don't leave the just-uploaded
  // file orphaned (issue #139 M2).
  const result = await withImageRollback(
    () => createPigeonShowcase(input),
    () => deletePigeonShowcaseImageFile(imageFileName),
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  // createPigeonShowcase always sets id alongside ok:true — the outcome
  // type's `id` is typed optional only because the ok:false branch above
  // never has one.
  const showcaseId = result.id as number;

  try {
    const descriptionImageFileNames = await saveDescriptionImages("pigeon-showcase", showcaseId, descriptionImages);
    const descriptionImageUrls = descriptionImageFileNames.map((fileName) =>
      descriptionImageUrl("pigeon-showcase", showcaseId, fileName),
    );
    const finalDescription = sanitizeDescriptionHtml(resolveDescriptionImagePlaceholders(description, descriptionImageUrls));
    await updatePigeonShowcaseDescription(showcaseId, finalDescription);
  } catch (error) {
    await deletePigeonShowcase(showcaseId);
    await deletePigeonShowcaseImageFile(imageFileName);
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: showcaseId });
}
