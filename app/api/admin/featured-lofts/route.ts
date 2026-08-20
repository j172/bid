import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import {
  createFeaturedLoftPost,
  isFeaturedLoftPostPageSize,
  listFeaturedLoftPosts,
  type FeaturedLoftPostInput,
} from "@/lib/featuredLoftPosts";
import { validateFeaturedLoftPostContent, validateFeaturedLoftPostTitle } from "@/lib/featuredLoftPostValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import {
  deleteFeaturedLoftPostImageFile,
  saveFeaturedLoftPostImage,
  saveImageOrError,
  withImageRollback,
} from "@/lib/uploads";

// Admin list view — matches the filters issue #176 asks for (modeled on
// news_posts): title substring search, selectable page size (30/50/100). No
// JOIN-only public equivalent lives here; the public list page
// (app/[locale]/featured-lofts/page.tsx) calls listFeaturedLoftPosts
// directly (server component), same as every other public page in this app
// reading straight from lib/*.ts.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const pageSize = isFeaturedLoftPostPageSize(pageSizeRaw) ? pageSizeRaw : undefined;

  const { items, total } = await listFeaturedLoftPosts({ search, page, pageSize });
  return NextResponse.json({ ok: true, items, total });
}

// Submits FormData (not JSON), same as news/pigeon-showcase — 主圖 upload is
// required on every create (see FeaturedLoftPostFormModal.tsx). loftId is
// optional: an empty/missing field means "no loft link", not a validation
// error.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const image = form.get("image");
  const loftIdRaw = String(form.get("loftId") ?? "").trim();
  const loftId = loftIdRaw ? Number(loftIdRaw) : null;

  const titleResult = validateFeaturedLoftPostTitle(title);
  if (!titleResult.ok) {
    return NextResponse.json({ ok: false, error: titleResult.error }, { status: 400 });
  }
  const contentResult = validateFeaturedLoftPostContent(content);
  if (!contentResult.ok) {
    return NextResponse.json({ ok: false, error: contentResult.error }, { status: 400 });
  }
  if (loftId !== null && (!Number.isFinite(loftId) || !Number.isInteger(loftId) || loftId <= 0)) {
    return NextResponse.json({ ok: false, error: "請選擇有效的鴿舍" }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "請上傳主圖" }, { status: 400 });
  }

  const saved = await saveImageOrError(() => saveFeaturedLoftPostImage(image));
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  }
  const imageFileName = saved.fileName;

  const input: FeaturedLoftPostInput = { title, content: sanitizeDescriptionHtml(content), imageFileName, loftId };
  // Rollback: if the row was never created, don't leave the just-uploaded
  // file orphaned (same "issue #139 M2" pairing news/pigeon-showcase use).
  const result = await withImageRollback(
    () => createFeaturedLoftPost(input),
    () => deleteFeaturedLoftPostImageFile(imageFileName),
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
