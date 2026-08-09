// Single place where every route handler under app/api decides "is this
// caller allowed in?" (issue #139 H1/H2). Before this, 40+ route handlers
// each re-wrote getCurrentUser() plus their own 401/403 block, and the admin
// half of them had drifted into two different behaviours: some answered a
// logged-out visitor with 403 僅限管理員 (as if they were a signed-in
// non-admin), others with the correct 401 請先登入 first. Both guards below
// are deliberately uniform: not logged in is always 401, logged in but not
// an admin is always 403.
//
// The two guards keep the two error *shapes* this app already had, since
// they serve different clients:
// - requireUser  → { ok: false, errorCode: "MUST_LOGIN" }, translated by the
//   public site's next-intl "errors" namespace (see lib/errorCodes.ts).
// - requireAdmin → { ok: false, error: "…" } in hardcoded Traditional
//   Chinese, because app/z04urru6 is deliberately kept out of next-intl (see
//   app/z04urru6/layout.tsx's header comment).
//
// Callers use it as:
//   const auth = await requireAdmin();
//   if (auth.response) return auth.response;
//   // auth.user is a CurrentUser from here on (narrowed by the check above)

import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";

export type AuthGuardResult =
  | { user: CurrentUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

// Any logged-in visitor (the /api/account and /api/listings write endpoints).
export async function requireUser(): Promise<AuthGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ ok: false, errorCode: "MUST_LOGIN" }, { status: 401 }) };
  }
  return { user };
}

// Admins only (everything under /api/admin).
export async function requireAdmin(): Promise<AuthGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 }) };
  }
  if (user.role !== "admin") {
    return { response: NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 }) };
  }
  return { user };
}
