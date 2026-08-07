import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteNews, updateNews, type NewsPostInput } from "@/lib/news";
import { validateNewsContent, validateNewsTitle } from "@/lib/newsValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";

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

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "請求格式不正確" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();

  const titleResult = validateNewsTitle(title);
  if (!titleResult.ok) {
    return NextResponse.json({ ok: false, error: titleResult.error }, { status: 400 });
  }
  const contentResult = validateNewsContent(content);
  if (!contentResult.ok) {
    return NextResponse.json({ ok: false, error: contentResult.error }, { status: 400 });
  }

  const input: NewsPostInput = { title, content: sanitizeDescriptionHtml(content) };
  const result = await updateNews(newsId, input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
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

  const result = await deleteNews(newsId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
