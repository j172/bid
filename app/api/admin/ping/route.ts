import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  return NextResponse.json({ ok: true, message: "pong", admin: auth.user.email });
}
