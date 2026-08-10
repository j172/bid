import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { cancelBroadcast } from "@/lib/newsletter";
import { newsletterErrorMessage } from "@/lib/newsNewsletterSync";

// `id` here is Resend's own broadcast id (an opaque string), not a row id —
// hence no parseIdParam, unlike the other [id] admin routes.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const result = await cancelBroadcast(id);
  if (!result.ok) {
    // Translated here rather than handing the raw BroadcastErrorCode to the
    // browser (issue #139 M4) — app/z04urru6 has no next-intl catalogue to
    // resolve one against, so every other admin route already answers with a
    // ready-to-display Traditional Chinese `error`.
    return NextResponse.json(
      { ok: false, error: newsletterErrorMessage(result.errorCode, "cancel") },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
