import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { deleteAccount, destroySession } from "@/lib/auth";

export async function POST() {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const result = await deleteAccount(auth.user.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 400 });
  }

  // deleteAccount already removed all of this user's session rows from the
  // DB; destroySession just clears the now-dangling cookie in the browser.
  await destroySession();
  return NextResponse.json({ ok: true });
}
