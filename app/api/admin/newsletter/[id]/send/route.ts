import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendBroadcast } from "@/lib/newsletter";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const scheduledAtRaw = typeof body?.scheduledAt === "string" ? body.scheduledAt.trim() : "";

  let scheduledAt: string | undefined;
  if (scheduledAtRaw) {
    const parsed = new Date(scheduledAtRaw);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, error: "排程時間必須是有效的未來時間" }, { status: 400 });
    }
    scheduledAt = parsed.toISOString();
  }

  const result = await sendBroadcast(id, scheduledAt);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
