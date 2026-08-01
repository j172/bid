import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelBroadcast } from "@/lib/newsletter";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const result = await cancelBroadcast(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
