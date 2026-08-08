import { NextResponse } from "next/server";
import { adminDisableTwoFactor, getCurrentUser, getUserDetail } from "@/lib/auth";

// Admin rescue path (issue #93) for an account locked out of its own Email
// OTP (can't receive the code email, etc.) — same shape as #91's sibling
// app/api/admin/users/[id]/reset-password/route.ts: admin-only, no
// anti-enumeration (the caller is already looking at a specific account's
// detail page), plain hardcoded Traditional Chinese errors per that route's
// header comment on why app/z04urru6 stays out of the ErrorCode/next-intl
// pattern.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const targetUserId = Number(id);
  if (!Number.isFinite(targetUserId)) {
    return NextResponse.json({ ok: false, error: "找不到這個使用者" }, { status: 404 });
  }

  const target = await getUserDetail(targetUserId);
  if (!target || target.status === "deleted") {
    return NextResponse.json({ ok: false, error: "找不到這個使用者" }, { status: 404 });
  }

  await adminDisableTwoFactor(target.id);

  return NextResponse.json({ ok: true });
}
