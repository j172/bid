import { NextResponse } from "next/server";
import { createSession, createUser, findUserByEmail } from "@/lib/auth";
import { validateProfile } from "@/lib/profile";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName : "";
  const phone = typeof body?.phone === "string" ? body.phone : "";
  const address = typeof body?.address === "string" ? body.address : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "請輸入有效的 email" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "密碼至少需要 8 個字元" }, { status: 400 });
  }

  const profileResult = validateProfile({ displayName, phone, address });
  if (!profileResult.ok) {
    return NextResponse.json({ ok: false, error: profileResult.error }, { status: 400 });
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ ok: false, error: "這個 email 已經註冊過了" }, { status: 409 });
  }

  const user = await createUser(email, password, { displayName, phone, address });
  await createSession(user.id);

  return NextResponse.json({ ok: true, user });
}
