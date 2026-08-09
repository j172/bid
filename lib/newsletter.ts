import { resendRequest } from "./email";

export type BroadcastStatus = "draft" | "scheduled" | "sent" | "queued" | "canceled" | (string & {});

export type Broadcast = {
  id: string;
  subject: string | null;
  status: BroadcastStatus;
  scheduledAt: string | null;
  createdAt: string | null;
};

export type BroadcastErrorCode = "NOT_CONFIGURED" | "PROVIDER_ERROR" | "NOT_FOUND";
type ErrorCode = BroadcastErrorCode;
type Result = { ok: true } | { ok: false; errorCode: ErrorCode };
type ResultWithId = { ok: true; id: string } | { ok: false; errorCode: ErrorCode };
type ListResult = { ok: true; broadcasts: Broadcast[] } | { ok: false; errorCode: ErrorCode };
type GetResult = { ok: true; broadcast: Broadcast } | { ok: false; errorCode: ErrorCode };

function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID);
}

// Resend's JSON -> this module's Broadcast. Shared by listBroadcasts and
// getBroadcast, which had the same field-by-field mapping written out twice
// (issue #139) — the kind of copy where only one side learns about a
// renamed/added field.
function mapBroadcast(item: Record<string, unknown>): Broadcast {
  return {
    id: String(item.id),
    subject: (item.subject as string | undefined) ?? null,
    status: (item.status as BroadcastStatus | undefined) ?? "draft",
    scheduledAt: (item.scheduled_at as string | undefined) ?? null,
    createdAt: (item.created_at as string | undefined) ?? null,
  };
}

// News → newsletter sync (issue #73): when an admin opts in at news-post
// creation time, the API route builds a broadcast from that post using this
// helper — the post's own (already-sanitized) content HTML as-is, plus one
// line linking back to the post's public detail page so subscribers can
// visit the site for the canonical version instead of only the email copy.
// Pure/no I/O so it's directly unit-testable, same split as this project's
// other lib/*Validation.ts-style helpers.
export function buildNewsBroadcastHtml(contentHtml: string, detailUrl: string): string {
  return `${contentHtml}\n<p><a href="${detailUrl}">查看完整內容</a></p>`;
}

export async function listBroadcasts(): Promise<ListResult> {
  if (!isConfigured()) return { ok: false, errorCode: "NOT_CONFIGURED" };

  try {
    const { status, body } = await resendRequest("GET", "/broadcasts");
    if (status < 200 || status >= 300) {
      console.error(`Failed to list broadcasts (${status}): ${body}`);
      return { ok: false, errorCode: "PROVIDER_ERROR" };
    }

    const parsed = JSON.parse(body) as { data?: Array<Record<string, unknown>> };
    return { ok: true, broadcasts: (parsed.data ?? []).map(mapBroadcast) };
  } catch (error) {
    console.error("Failed to list broadcasts:", error);
    return { ok: false, errorCode: "PROVIDER_ERROR" };
  }
}

// Single-broadcast status lookup (issue #80) — used by the news edit route
// to decide whether a post's linked broadcast is still editable (anything
// short of "sent") without pulling every broadcast on the account the way
// listBroadcasts()/the old standalone status page did.
export async function getBroadcast(id: string): Promise<GetResult> {
  if (!isConfigured()) return { ok: false, errorCode: "NOT_CONFIGURED" };

  try {
    const { status, body } = await resendRequest("GET", `/broadcasts/${id}`);
    if (status === 404) return { ok: false, errorCode: "NOT_FOUND" };
    if (status < 200 || status >= 300) {
      console.error(`Failed to get broadcast ${id} (${status}): ${body}`);
      return { ok: false, errorCode: "PROVIDER_ERROR" };
    }

    const item = JSON.parse(body) as Record<string, unknown>;
    return { ok: true, broadcast: mapBroadcast(item) };
  } catch (error) {
    console.error(`Failed to get broadcast ${id}:`, error);
    return { ok: false, errorCode: "PROVIDER_ERROR" };
  }
}

// Creates a draft broadcast against the site's single Resend Audience.
// Drafts aren't delivered until sendBroadcast() is called separately.
export async function createBroadcast(subject: string, html: string): Promise<ResultWithId> {
  if (!isConfigured()) return { ok: false, errorCode: "NOT_CONFIGURED" };

  try {
    const { status, body } = await resendRequest("POST", "/broadcasts", {
      audience_id: process.env.RESEND_AUDIENCE_ID,
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      subject,
      html,
    });

    if (status < 200 || status >= 300) {
      console.error(`Failed to create broadcast (${status}): ${body}`);
      return { ok: false, errorCode: "PROVIDER_ERROR" };
    }

    const parsed = JSON.parse(body) as { id: string };
    return { ok: true, id: parsed.id };
  } catch (error) {
    console.error("Failed to create broadcast:", error);
    return { ok: false, errorCode: "PROVIDER_ERROR" };
  }
}

// scheduledAt: ISO string for a future send, or omitted to send immediately.
export async function sendBroadcast(id: string, scheduledAt?: string): Promise<Result> {
  if (!isConfigured()) return { ok: false, errorCode: "NOT_CONFIGURED" };

  try {
    const { status, body } = await resendRequest(
      "POST",
      `/broadcasts/${id}/send`,
      scheduledAt ? { scheduled_at: scheduledAt } : {},
    );

    if (status < 200 || status >= 300) {
      console.error(`Failed to send broadcast ${id} (${status}): ${body}`);
      return { ok: false, errorCode: "PROVIDER_ERROR" };
    }
    return { ok: true };
  } catch (error) {
    console.error(`Failed to send broadcast ${id}:`, error);
    return { ok: false, errorCode: "PROVIDER_ERROR" };
  }
}

// Only works while the broadcast is still a draft or a pending scheduled
// send — Resend rejects this once a send is actually in flight or done.
export async function cancelBroadcast(id: string): Promise<Result> {
  if (!isConfigured()) return { ok: false, errorCode: "NOT_CONFIGURED" };

  try {
    const { status, body } = await resendRequest("DELETE", `/broadcasts/${id}`);
    if (status < 200 || status >= 300) {
      console.error(`Failed to cancel broadcast ${id} (${status}): ${body}`);
      return { ok: false, errorCode: "PROVIDER_ERROR" };
    }
    return { ok: true };
  } catch (error) {
    console.error(`Failed to cancel broadcast ${id}:`, error);
    return { ok: false, errorCode: "PROVIDER_ERROR" };
  }
}
