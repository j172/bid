import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import {
  deleteFeaturedLoftPost,
  getFeaturedLoftPostById,
  updateFeaturedLoftPost,
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
import { parseIdParam } from "@/lib/routeParams";

// Submits FormData (not JSON) — like news_posts' PATCH route, 主圖 must be
// (re)selected on every edit, so this always saves a new file and always
// retires the old one. loftId stays optional here too: an empty field
// clears any existing loft link rather than erroring.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const postId = parseIdParam(id);
  if (postId === null) {
    return NextResponse.json({ ok: false, error: "找不到這篇名家專區文章" }, { status: 404 });
  }

  const existing = await getFeaturedLoftPostById(postId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這篇名家專區文章" }, { status: 404 });
  }

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
  const result = await withImageRollback(
    () => updateFeaturedLoftPost(postId, input),
    () => deleteFeaturedLoftPostImageFile(imageFileName),
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (existing.imageFileName) {
    await deleteFeaturedLoftPostImageFile(existing.imageFileName);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const postId = parseIdParam(id);
  if (postId === null) {
    return NextResponse.json({ ok: false, error: "找不到這篇名家專區文章" }, { status: 404 });
  }

  const existing = await getFeaturedLoftPostById(postId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這篇名家專區文章" }, { status: 404 });
  }

  const result = await deleteFeaturedLoftPost(postId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  if (existing.imageFileName) {
    await deleteFeaturedLoftPostImageFile(existing.imageFileName);
  }
  return NextResponse.json({ ok: true });
}
