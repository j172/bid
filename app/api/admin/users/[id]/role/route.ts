import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { setUserRole } from "@/lib/auth";
import { parseIdParam } from "@/lib/routeParams";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const targetUserId = parseIdParam(id);
  if (targetUserId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個使用者" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const role = body?.role;
  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ ok: false, error: "角色參數不正確" }, { status: 400 });
  }

  const result = await setUserRole(targetUserId, role, auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
