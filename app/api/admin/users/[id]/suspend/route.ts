import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { suspendUser } from "@/lib/auth";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const targetUserId = parseIdParam(id);
  if (targetUserId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個使用者" }, { status: 404 });
  }

  const result = await suspendUser(targetUserId, auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
