// Shared helpers for the news↔newsletter sync (issue #80): both
// app/api/admin/news/route.ts (create) and app/api/admin/news/[id]/route.ts
// (edit) need the same "parse an optional client-supplied schedule" /
// "translate a BroadcastErrorCode into a user-facing message" /
// "resolve the absolute detail-page URL for the broadcast link" logic, so it
// lives here once instead of duplicated per route. Pure/no I/O (resolveOrigin
// only reads from the Request it's given) — directly unit-testable, same
// split as this project's other lib/*Validation.ts-style helpers.

import type { BroadcastErrorCode } from "@/lib/newsletter";

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
