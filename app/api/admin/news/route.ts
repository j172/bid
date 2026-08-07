import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createNews, isNewsPageSize, listNews, type NewsPostInput } from "@/lib/news";
import { validateNewsContent, validateNewsTitle } from "@/lib/newsValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { deleteNewsImageFile, saveNewsImage } from "@/lib/uploads";
import { buildNewsBroadcastHtml, createBroadcast, sendBroadcast, type BroadcastErrorCode } from "@/lib/newsletter";

// This host's reverse proxy (.remote-index.php) forwards the original
// public Host/protocol as X-Forwarded-Host / X-Forwarded-Proto (Node itself
// only ever sees plain http://127.0.0.1 — see that file's header comment),
// so those take priority when building the absolute /news/[id] link that
// goes out in the newsletter. Falls back to the request's own URL for local
// dev, where neither forwarded header is present.
function resolveOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!forwardedHost) return new URL(request.url).origin;
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${forwardedProto}://${forwardedHost}`;
}

function newsletterErrorMessage(errorCode: BroadcastErrorCode, stage: "create" | "send"): string {
  if (errorCode === "NOT_CONFIGURED") {
    return "電子報寄送失敗：尚未設定 RESEND_API_KEY / RESEND_AUDIENCE_ID。";
  }
  return stage === "create"
    ? "電子報建立失敗，請至「電子報」頁面手動處理。"
    : "電子報已建立但寄送失敗，請至「電子報」頁面確認草稿狀態。";
}

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
  // create-mode-only opt-in (issue #73) — NewsFormModal never sends this
  // field when editing, so absence here just means "no newsletter action".
  // Sent as a FormData string ("true") rather than JSON boolean since issue
  // #70 switched this endpoint to multipart submission for the image field.
  const sendNewsletter = form.get("sendNewsletter") === "true";

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

  // The news post and the newsletter broadcast are deliberately independent
  // (issue #73): the post is already committed at this point, so a
  // broadcast failure (e.g. Resend not configured) must never roll it back
  // or turn this response into a failure — it's reported separately via
  // `newsletterError` for the client to surface as its own notice.
  let newsletterError: string | undefined;
  if (sendNewsletter) {
    const detailUrl = `${resolveOrigin(request)}/news/${result.id}`;
    const html = buildNewsBroadcastHtml(input.content, detailUrl);
    const created = await createBroadcast(title, html);
    if (!created.ok) {
      newsletterError = newsletterErrorMessage(created.errorCode, "create");
    } else {
      const sent = await sendBroadcast(created.id);
      if (!sent.ok) {
        newsletterError = newsletterErrorMessage(sent.errorCode, "send");
      }
    }
  }

  return NextResponse.json({ ok: true, id: result.id, newsletterError });
}
