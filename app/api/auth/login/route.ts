import { NextResponse } from "next/server";
import { createSession, findUserByEmail, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) {
    return NextResponse.json({ ok: false, error: "email 或密碼錯誤" }, { status: 401 });
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
}
