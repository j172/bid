import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import {
  createPigeonShowcase,
  isPigeonShowcasePageSize,
  listPigeonShowcase,
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

  const saved = await saveImageOrError(() => savePigeonShowcaseImage(image));
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  }
  const imageFileName = saved.fileName;

  const input: PigeonShowcaseInput = {
    category,
    name,
    loftId,
    description: sanitizeDescriptionHtml(description),
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
  return NextResponse.json({ ok: true, id: result.id });
}
