import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LINE_ONBOARD_COOKIE, verifyLineOnboardToken } from "@/lib/lineAuth";
import {
  createSession,
  findUserByEmail,
  linkLineUserId,
  verifyCurrentPassword,
} from "@/lib/auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(LINE_ONBOARD_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, errorCode: "LINE_ONBOARD_EXPIRED" }, { status: 401 });
  }

  const onboardData = verifyLineOnboardToken(token);
  if (!onboardData) {
    cookieStore.delete(LINE_ONBOARD_COOKIE);
    return NextResponse.json({ ok: false, errorCode: "LINE_ONBOARD_EXPIRED" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" },
      { status: 400 },
    );
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return NextResponse.json(
      { ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" },
      { status: 400 },
    );
  }

  if (user.suspended_at !== null) {
    return NextResponse.json({ ok: false, errorCode: "ACCOUNT_SUSPENDED" }, { status: 403 });
  }

  const passwordValid = await verifyCurrentPassword(user.id, password);
  if (!passwordValid) {
    return NextResponse.json(
      { ok: false, errorCode: "EMAIL_OR_PASSWORD_INCORRECT" },
      { status: 400 },
    );
  }

  await linkLineUserId(user.id, onboardData.lineUserId);
  await createSession(user.id);
  cookieStore.delete(LINE_ONBOARD_COOKIE);

  return NextResponse.json(
    { ok: true, user: { id: user.id, email: user.email, role: user.role } },
    { status: 200 },
  );
}
