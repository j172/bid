import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reorderHomepageSections } from "@/lib/homepageSections";

// Bulk re-sequence: body is { sectionType, orderedIds: number[] } — see
// reorderHomepageSections' comment for why this is a single atomic call
// rather than one PATCH per row.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const sectionType = typeof body?.sectionType === "string" ? body.sectionType.trim() : "";
  const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : null;

  if (!sectionType) {
    return NextResponse.json({ ok: false, error: "缺少 sectionType 參數" }, { status: 400 });
  }
  if (!orderedIds || !orderedIds.every((id: unknown) => typeof id === "number" && Number.isFinite(id))) {
    return NextResponse.json({ ok: false, error: "排序資料不正確" }, { status: 400 });
  }

  const result = await reorderHomepageSections(sectionType, orderedIds);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
