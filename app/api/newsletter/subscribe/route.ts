import { NextResponse } from "next/server";
import { isValidEmail } from "@/lib/shared/validation/emailValidation";
import { subscribeNewsletter } from "@/lib/shared/communications/email";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, errorCode: "EMAIL_INVALID" }, { status: 400 });
  }

  const result = await subscribeNewsletter(email);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
