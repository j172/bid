import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LINE_ONBOARD_COOKIE, verifyLineOnboardToken } from "@/lib/lineAuth";
import { findUserByEmail } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(LINE_ONBOARD_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, errorCode: "LINE_ONBOARD_EXPIRED" }, { status: 401 });
  }

  const data = verifyLineOnboardToken(token);
  if (!data) {
    cookieStore.delete(LINE_ONBOARD_COOKIE);
    return NextResponse.json({ ok: false, errorCode: "LINE_ONBOARD_EXPIRED" }, { status: 401 });
  }

  let emailExists = false;
  if (data.email) {
    const existing = await findUserByEmail(data.email);
    emailExists = Boolean(existing);
  }

  return NextResponse.json({
    ok: true,
    data: {
      displayName: data.displayName || "",
      email: data.email || "",
      picture: data.picture || null,
      emailExists,
    },
  });
}
