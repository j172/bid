import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const html = typeof body?.html === "string" ? body.html : "";

  if (!subject) {
    return NextResponse.json({ ok: false, error: "請輸入主旨" }, { status: 400 });
  }
  if (!html.trim()) {
    return NextResponse.json({ ok: false, error: "請輸入內容" }, { status: 400 });
  }

  await sendEmail(user.email, `[測試] ${subject}`, html);
  return NextResponse.json({ ok: true });
}
