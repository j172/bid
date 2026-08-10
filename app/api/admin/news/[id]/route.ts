import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { deleteNews, getNewsById, setNewsBroadcastId, updateNews, type NewsPostInput } from "@/lib/news";
import { validateNewsContent, validateNewsTitle } from "@/lib/newsValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";
import { deleteNewsImageFile, saveImageOrError, saveNewsImage, withImageRollback } from "@/lib/uploads";
import { buildNewsBroadcastHtml, cancelBroadcast, createBroadcast, getBroadcast, sendBroadcast, type BroadcastStatus } from "@/lib/newsletter";
import { newsletterErrorMessage, parseScheduledAt, resolveOrigin } from "@/lib/newsNewsletterSync";
import { parseIdParam } from "@/lib/routeParams";

// Resolves whether newsId's linked broadcast (if any) is still editable, per
// issue #5's "只要...電子報狀態還沒到已寄出（sent），編輯...都可以勾選/取消/
// 改排程" rule. Three outcomes:
// - no broadcastId yet → nothing to lock, starts fresh if opted in below.
// - broadcastId set and its live status fetched successfully → "sent" locks
//   further changes; everything else (draft/scheduled/queued/canceled) stays
//   editable.
// - status fetch failed (Resend down/not configured/broadcast gone) →
//   "unknown", handled by the caller as "don't touch it" rather than guessed.
async function resolveBroadcastLock(
  broadcastId: string | null,
): Promise<{ status: BroadcastStatus | null; unknown: boolean }> {
  if (!broadcastId) return { status: null, unknown: false };

  const fetched = await getBroadcast(broadcastId);
  if (fetched.ok) return { status: fetched.broadcast.status, unknown: false };
  if (fetched.errorCode === "NOT_FOUND") return { status: null, unknown: false };
  return { status: null, unknown: true };
}

// Submits FormData (not JSON) as of issue #70 — unlike homepage_sections'
// PATCH route (image replacement optional, keeps the existing file when
// omitted), news_posts' 主圖 must be (re)selected on every edit too, per
// issue #70's explicit "新增／編輯時前後端都強制要求上傳" requirement — so
// this always saves a new file and always retires the old one.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const newsId = parseIdParam(id);
  if (newsId === null) {
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
  // Unlike create (where the field's absence just means "no opt-in"),
  // NewsFormModal always sends this in edit mode (issue #80) — "false" here
  // is a real signal to cancel an active broadcast, not an omitted field.
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
  const result = await withImageRollback(
    () => updateNews(newsId, input),
    () => deleteNewsImageFile(imageFileName),
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (existing.imageFileName) {
    await deleteNewsImageFile(existing.imageFileName);
  }

  // Newsletter sync (issue #80) — independent of the content save above
  // already having succeeded, same best-effort/non-blocking relationship to
  // the post as create (#73): a broadcast failure is reported via
  // `newsletterError` without undoing the (already-committed) content edit.
  let newsletterError: string | undefined;
  const currentBroadcastId = existing.broadcastId;
  const { status: currentStatus, unknown: statusUnknown } = await resolveBroadcastLock(currentBroadcastId);

  if (statusUnknown) {
    // Can't confirm the lock state — don't risk creating a duplicate
    // broadcast or canceling a live send blind. Only surface an error if the
    // admin actually tried to change something; a plain content edit with no
    // newsletter change goes through silently, same as before #80.
    if (sendNewsletter !== Boolean(currentBroadcastId)) {
      newsletterError = "無法確認目前電子報狀態，本次未異動電子報設定，請稍後再試。";
    }
  } else if (currentStatus !== "sent") {
    if (sendNewsletter) {
      if (currentStatus === "queued") {
        // Actively mid-send — replacing it now risks a duplicate delivery to
        // the whole audience, so this window is refused rather than raced.
        newsletterError = "電子報正在寄送中，請稍後再編輯電子報設定。";
      } else {
        const schedule = parseScheduledAt(scheduledAtRaw);
        if (!schedule.ok) {
          newsletterError = "排程時間必須是有效的未來時間，電子報未更新。";
        } else {
          // lib/newsletter.ts has no "update broadcast" call, only
          // create/send/cancel (issue #80 keeps that surface as-is) — so a
          // content/schedule change replaces the old broadcast with a fresh
          // one instead of editing it in place. Best-effort: an
          // already-terminal old broadcast (e.g. already canceled) failing
          // to cancel again doesn't block creating the new one.
          if (currentBroadcastId && currentStatus && currentStatus !== "canceled") {
            await cancelBroadcast(currentBroadcastId);
          }
          const detailUrl = `${resolveOrigin(request)}/news/${newsId}`;
          const html = buildNewsBroadcastHtml(input.content, detailUrl);
          const created = await createBroadcast(title, html);
          if (!created.ok) {
            newsletterError = newsletterErrorMessage(created.errorCode, "create");
          } else {
            await setNewsBroadcastId(newsId, created.id);
            const sent = await sendBroadcast(created.id, schedule.scheduledAt);
            if (!sent.ok) {
              newsletterError = newsletterErrorMessage(sent.errorCode, "send");
            }
          }
        }
      }
    } else if (currentBroadcastId && currentStatus && currentStatus !== "canceled") {
      if (currentStatus === "queued") {
        newsletterError = "電子報正在寄送中，無法取消。";
      } else {
        // Explicit uncheck of an active (draft/scheduled) broadcast — same
        // effect as the news list's inline cancel action, just triggered
        // from the edit form.
        const canceled = await cancelBroadcast(currentBroadcastId);
        if (!canceled.ok) {
          newsletterError = "取消電子報失敗，請至列表使用取消按鈕重試。";
        }
      }
    }
  }
  // currentStatus === "sent": locked, any sendNewsletter/scheduledAt from the
  // client is ignored outright — already-sent mail is never resent/updated.

  return NextResponse.json({ ok: true, newsletterError });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const newsId = parseIdParam(id);
  if (newsId === null) {
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
