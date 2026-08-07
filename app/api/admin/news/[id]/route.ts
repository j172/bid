import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteNews, getNewsById, updateNews, type NewsPostInput } from "@/lib/news";
import { validateNewsContent, validateNewsTitle } from "@/lib/newsValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { deleteNewsImageFile, saveNewsImage } from "@/lib/uploads";

// Submits FormData (not JSON) as of issue #70 — unlike homepage_sections'
// PATCH route (image replacement optional, keeps the existing file when
// omitted), news_posts' 主圖 must be (re)selected on every edit too, per
// issue #70's explicit "新增／編輯時前後端都強制要求上傳" requirement — so
// this always saves a new file and always retires the old one.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) {
    return NextResponse.json({ ok: false, error: "找不到這則訊息" }, { status: 404 });
  }

  const existing = await getNewsById(newsId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這則訊息" }, { status: 404 });
  }

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const image = form.get("image");

  const titleResult = validateNewsTitle(title);
  if (!titleResult.ok) {
    return NextResponse.json({ ok: false, error: titleResult.error }, { status: 400 });
  }
  const contentResult = validateNewsContent(content);
  if (!contentResult.ok) {
    return NextResponse.json({ ok: false, error: contentResult.error }, { status: 400 });
  }
  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ ok: false, error: "請上傳主圖" }, { status: 400 });
  }

  let imageFileName: string;
  try {
    imageFileName = await saveNewsImage(image);
  } catch (error) {
    const message = error instanceof Error ? error.message : "圖片上傳失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const input: NewsPostInput = { title, content: sanitizeDescriptionHtml(content), imageFileName };
  const result = await updateNews(newsId, input);
  if (!result.ok) {
    await deleteNewsImageFile(imageFileName);
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (existing.imageFileName) {
    await deleteNewsImageFile(existing.imageFileName);
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
  const newsId = Number(id);
  if (!Number.isFinite(newsId)) {
    return NextResponse.json({ ok: false, error: "找不到這則訊息" }, { status: 404 });
  }

  const existing = await getNewsById(newsId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這則訊息" }, { status: 404 });
  }

  const result = await deleteNews(newsId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  if (existing.imageFileName) {
    await deleteNewsImageFile(existing.imageFileName);
  }
  return NextResponse.json({ ok: true });
}
