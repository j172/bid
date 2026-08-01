import { NextResponse } from "next/server";
import { deleteAccount, destroySession, getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, errorCode: "MUST_LOGIN" }, { status: 401 });
  }

  const result = await deleteAccount(user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  // deleteAccount already removed all of this user's session rows from the
  // DB; destroySession just clears the now-dangling cookie in the browser.
  await destroySession();
  return NextResponse.json({ ok: true });
}
