import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { unsuspendUser } from "@/lib/auth";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const targetUserId = parseIdParam(id);
  if (targetUserId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個使用者" }, { status: 404 });
  }

  // Same shape as the sibling suspend route now that unsuspendUser checks
  // the target exists (issue #139 M5) — it used to report success for an id
  // that was never there.
  const result = await unsuspendUser(targetUserId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
