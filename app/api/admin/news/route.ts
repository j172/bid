import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createNews, isNewsPageSize, listNews, type NewsPostInput } from "@/lib/news";
import { validateNewsContent, validateNewsTitle } from "@/lib/newsValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { deleteNewsImageFile, saveNewsImage } from "@/lib/uploads";

// Admin list view — matches the filters issue #56 asks for: title substring
// search, selectable page size (30/50/100). No JOIN-only public equivalent
// lives here; the public list page (app/[locale]/news/page.tsx) calls
// listNews directly (server component), same as every other public page in
// this app reading straight from lib/*.ts.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const pageSize = isNewsPageSize(pageSizeRaw) ? pageSizeRaw : undefined;

  const { items, total } = await listNews({ search, page, pageSize });
  return NextResponse.json({ ok: true, items, total });
}

// Submits FormData (not JSON) as of issue #70 — 主圖 upload is required on
// every create, front and back end both (see NewsFormModal.tsx).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
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
  const result = await createNews(input);
  if (!result.ok) {
    // Row was never created — don't leave the just-uploaded file orphaned.
    await deleteNewsImageFile(imageFileName);
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
