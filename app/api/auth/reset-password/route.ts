import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/passwordReset";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!token) {
    return NextResponse.json({ ok: false, errorCode: "RESET_TOKEN_INVALID" }, { status: 400 });
  }

  const result = await resetPassword(token, newPassword);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
