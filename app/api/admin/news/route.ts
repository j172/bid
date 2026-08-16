import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { createNews, isNewsPageSize, listNews, type NewsPostInput } from "@/lib/news";
import { validateNewsContent, validateNewsTitle } from "@/lib/newsValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { deleteNewsImageFile, saveImageOrError, saveNewsImage, withImageRollback } from "@/lib/uploads";
import { createAndSendNewsBroadcast, resolveOrigin } from "@/lib/newsNewsletterSync";

// Admin list view — matches the filters issue #56 asks for: title substring
// search, selectable page size (30/50/100). No JOIN-only public equivalent
// lives here; the public list page (app/[locale]/news/page.tsx) calls
// listNews directly (server component), same as every other public page in
// this app reading straight from lib/*.ts.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

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
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const form = await request.formData();
  const title = String(form.get("title") ?? "").trim();
  const content = String(form.get("content") ?? "").trim();
  const image = form.get("image");
  // Sent as FormData strings ("true"/ISO datetime) rather than JSON since
  // issue #70 switched this endpoint to multipart submission for the image
  // field. scheduledAt is only meaningful when sendNewsletter is set —
  // absent/empty means "send immediately" (issue #80).
  const sendNewsletter = form.get("sendNewsletter") === "true";
  const scheduledAtRaw = String(form.get("scheduledAt") ?? "").trim();

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

  const saved = await saveImageOrError(() => saveNewsImage(image));
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 400 });
  }
  const imageFileName = saved.fileName;

  const input: NewsPostInput = { title, content: sanitizeDescriptionHtml(content), imageFileName };
  // Rollback: if the row was never created, don't leave the just-uploaded
  // file orphaned (issue #139 M2 — the same pairing as the edit route below
  // and both pigeon-showcase routes).
  const result = await withImageRollback(
    () => createNews(input),
    () => deleteNewsImageFile(imageFileName),
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  // createNews always sets id alongside ok:true — NewsPostOutcome's `id` is
  // typed optional only because the ok:false branch above never has one.
  const newsId = result.id as number;

  // The news post and the newsletter broadcast are deliberately independent
  // (issue #73, extended by #80): the post is already committed at this
  // point, so a broadcast failure (e.g. Resend not configured, bad schedule)
  // must never roll it back or turn this response into a failure — it's
  // reported separately via `newsletterError` for the client to surface as
  // its own notice.
  let newsletterError: string | undefined;
  if (sendNewsletter) {
    const detailUrl = `${resolveOrigin(request)}/news/${newsId}`;
    const outcome = await createAndSendNewsBroadcast({
      newsId,
      title,
      content: input.content,
      detailUrl,
      scheduledAtRaw,
      invalidScheduleError: "排程時間必須是有效的未來時間，電子報未寄送。",
    });
    newsletterError = outcome.newsletterError;
  }

  return NextResponse.json({ ok: true, id: result.id, newsletterError });
}
