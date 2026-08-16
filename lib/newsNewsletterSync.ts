// Shared helpers for the news↔newsletter sync (issue #80): both
// app/api/admin/news/route.ts (create) and app/api/admin/news/[id]/route.ts
// (edit) need the same "parse an optional client-supplied schedule" /
// "translate a BroadcastErrorCode into a user-facing message" /
// "resolve the absolute detail-page URL for the broadcast link" logic, so it
// lives here once instead of duplicated per route. Pure/no I/O (resolveOrigin
// only reads from the Request it's given) — directly unit-testable, same
// split as this project's other lib/*Validation.ts-style helpers.
//
// createAndSendNewsBroadcast/resolveBroadcastLock (issue #160 M4) do involve
// I/O (Resend + the news_posts row) — they used to be ~60 lines of state
// machine written directly in the edit route handler, with the create route
// hand-copying the create+send half of the same sequence. Sunk here so both
// routes stay thin controllers that just decide *when* to call this, not
// *how* the sync works.

import {
  buildNewsBroadcastHtml,
  createBroadcast,
  getBroadcast,
  sendBroadcast,
  type BroadcastErrorCode,
  type BroadcastStatus,
} from "@/lib/newsletter";
import { setNewsBroadcastId } from "@/lib/news";

export type ScheduleParseResult = { ok: true; scheduledAt?: string } | { ok: false };

// scheduledAtRaw: ISO string from the client, already validated future-dated
// there (NewsFormModal) — re-validated here too since this is a
// server-authoritative boundary. Empty input means "send immediately";
// present-but-invalid is a distinct failure (not silently coerced into
// "immediately", which would ignore what the admin actually asked for).
export function parseScheduledAt(scheduledAtRaw: string): ScheduleParseResult {
  if (!scheduledAtRaw) return { ok: true };
  const parsed = new Date(scheduledAtRaw);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) return { ok: false };
  return { ok: true, scheduledAt: parsed.toISOString() };
}

// "cancel" was added by issue #139 (M4): app/api/admin/newsletter/[id]'s
// DELETE was the one admin route still handing the raw BroadcastErrorCode
// back to the browser, while every other newsletter-touching route answered
// with a translated Traditional Chinese `error` from here.
export function newsletterErrorMessage(errorCode: BroadcastErrorCode, stage: "create" | "send" | "cancel"): string {
  if (errorCode === "NOT_CONFIGURED") {
    return stage === "cancel"
      ? "電子報取消失敗：尚未設定 RESEND_API_KEY / RESEND_AUDIENCE_ID。"
      : "電子報寄送失敗：尚未設定 RESEND_API_KEY / RESEND_AUDIENCE_ID。";
  }
  if (stage === "cancel") {
    return errorCode === "NOT_FOUND"
      ? "找不到這封電子報，可能已經取消或寄出。"
      : "電子報取消失敗，請稍後再試一次。";
  }
  return stage === "create"
    ? "電子報建立失敗，請重新編輯這則訊息再試一次。"
    : "電子報已建立但寄送失敗，請重新編輯這則訊息確認狀態。";
}

// This host's reverse proxy (.remote-index.php) forwards the original
// public Host/protocol as X-Forwarded-Host / X-Forwarded-Proto (Node itself
// only ever sees plain http://127.0.0.1 — see that file's header comment),
// so those take priority when building the absolute /news/[id] link that
// goes out in the newsletter. Falls back to the request's own URL for local
// dev, where neither forwarded header is present.
export function resolveOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!forwardedHost) return new URL(request.url).origin;
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${forwardedProto}://${forwardedHost}`;
}

// Resolves whether newsId's linked broadcast (if any) is still editable, per
// issue #5's "只要...電子報狀態還沒到已寄出（sent），編輯...都可以勾選/取消/
// 改排程" rule. Three outcomes:
// - no broadcastId yet → nothing to lock, starts fresh if opted in below.
// - broadcastId set and its live status fetched successfully → "sent" locks
//   further changes; everything else (draft/scheduled/queued/canceled) stays
//   editable.
// - status fetch failed (Resend down/not configured/broadcast gone) →
//   "unknown", handled by the caller as "don't touch it" rather than guessed.
export async function resolveBroadcastLock(
  broadcastId: string | null,
): Promise<{ status: BroadcastStatus | null; unknown: boolean }> {
  if (!broadcastId) return { status: null, unknown: false };

  const fetched = await getBroadcast(broadcastId);
  if (fetched.ok) return { status: fetched.broadcast.status, unknown: false };
  if (fetched.errorCode === "NOT_FOUND") return { status: null, unknown: false };
  return { status: null, unknown: true };
}

export type CreateAndSendBroadcastParams = {
  newsId: number;
  title: string;
  content: string;
  detailUrl: string;
  scheduledAtRaw: string;
  // The two call sites (create/edit) phrase an invalid schedule differently
  // ("電子報未寄送" vs "電子報未更新") — everything else about the sequence
  // is identical, so the message stays the one thing the caller supplies.
  invalidScheduleError: string;
  // Edit-only: replacing an existing draft/scheduled broadcast cancels it
  // first (lib/newsletter.ts has no "update broadcast" call — see the edit
  // route's own comment on this). Runs only after the schedule is confirmed
  // valid, same ordering as the original inline logic, so an invalid
  // schedule never touches the still-active old broadcast. Create passes
  // nothing here — there's never a prior broadcast to cancel.
  beforeCreate?: () => Promise<void>;
};

// The create+send sequence shared verbatim by the news create and edit
// routes once an admin opts in to (re)sending the newsletter (issue #160
// M4): validate the schedule, create the Resend broadcast, persist its id
// on the news post immediately (so a later edit can retry/cancel even if the
// send below fails), then send it.
export async function createAndSendNewsBroadcast(
  params: CreateAndSendBroadcastParams,
): Promise<{ newsletterError?: string }> {
  const schedule = parseScheduledAt(params.scheduledAtRaw);
  if (!schedule.ok) {
    return { newsletterError: params.invalidScheduleError };
  }

  await params.beforeCreate?.();

  const html = buildNewsBroadcastHtml(params.content, params.detailUrl);
  const created = await createBroadcast(params.title, html);
  if (!created.ok) {
    return { newsletterError: newsletterErrorMessage(created.errorCode, "create") };
  }

  // Persisted as soon as the broadcast exists — even if the send below
  // fails, the post stays linked to this (still-draft) broadcast so a later
  // edit can retry/cancel it instead of orphaning a Resend draft nothing
  // ever points back to.
  await setNewsBroadcastId(params.newsId, created.id);
  const sent = await sendBroadcast(created.id, schedule.scheduledAt);
  if (!sent.ok) {
    return { newsletterError: newsletterErrorMessage(sent.errorCode, "send") };
  }
  return {};
}
