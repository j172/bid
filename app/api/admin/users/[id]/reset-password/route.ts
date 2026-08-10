import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { getUserDetail } from "@/lib/auth";
import { createPasswordResetToken, isPasswordResetRateLimited, resetPasswordPath } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/notifications";
import { resolveOrigin } from "@/lib/newsNewsletterSync";
import { parseIdParam } from "@/lib/routeParams";

// Admin-triggered counterpart to app/api/auth/forgot-password/route.ts
// (issue #91, building on #89). Unlike that route this is NOT anti-
// enumeration — the caller is already an authenticated admin looking at a
// specific account's detail page, so there's nothing to hide behind a
// neutral response, and errors are reported straight back to the UI. Reuses
// createPasswordResetToken/sendPasswordResetEmail directly rather than
// calling the public forgot-password endpoint, per the issue.
//
// Only the 60s-per-account cooldown applies here (isPasswordResetRateLimited
// with ip=null skips its IP-window check entirely — see that function), not
// the public route's IP limiting: the operator here is a verified admin, not
// an anonymous visitor, so there's no IP to rate-limit against.
//
// Like the sibling app/api/admin/users/[id]/{role,suspend,unsuspend} routes,
// this stays outside the ErrorCode/next-intl "errors" pattern on purpose —
// app/z04urru6 is deliberately kept out of next-intl (see
// app/z04urru6/layout.tsx's header comment) and lib/errorCodes.ts says
// admin-only modules are out of scope for that pattern, so failures are
// plain hardcoded Traditional Chinese, matching those routes.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const targetUserId = parseIdParam(id);
  if (targetUserId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個使用者" }, { status: 404 });
  }

  const target = await getUserDetail(targetUserId);
  if (!target || target.status === "deleted") {
    return NextResponse.json({ ok: false, error: "找不到這個使用者" }, { status: 404 });
  }

  if (await isPasswordResetRateLimited(target.id, null)) {
    return NextResponse.json(
      { ok: false, error: "剛才已經寄送過重設密碼信，請稍候一分鐘再試一次" },
      { status: 429 },
    );
  }

  const token = await createPasswordResetToken(target.id, null);
  const resetUrl = `${resolveOrigin(request)}${resetPasswordPath(target.locale, token)}`;
  await sendPasswordResetEmail(target.email, target.locale, resetUrl);

  return NextResponse.json({ ok: true, email: target.email });
}
