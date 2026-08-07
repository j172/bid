import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deletePigeonShowcase, updatePigeonShowcase, type PigeonShowcaseInput } from "@/lib/pigeonShowcase";
import {
  isPigeonShowcaseCategory,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
} from "@/lib/pigeonShowcaseValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const showcaseId = Number(id);
  if (!Number.isFinite(showcaseId)) {
    return NextResponse.json({ ok: false, error: "找不到這筆鴿況資料" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "請求格式不正確" }, { status: 400 });
  }

  const category = body.category;
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const loftId = Number(body.loftId);

  if (!isPigeonShowcaseCategory(category)) {
    return NextResponse.json({ ok: false, error: "請選擇鴿種" }, { status: 400 });
  }
  const nameResult = validatePigeonShowcaseName(name);
  if (!nameResult.ok) {
    return NextResponse.json({ ok: false, error: nameResult.error }, { status: 400 });
  }
  const descriptionResult = validatePigeonShowcaseDescription(description);
  if (!descriptionResult.ok) {
    return NextResponse.json({ ok: false, error: descriptionResult.error }, { status: 400 });
  }
  if (!Number.isFinite(loftId) || !Number.isInteger(loftId) || loftId <= 0) {
    return NextResponse.json({ ok: false, error: "請選擇鴿舍" }, { status: 400 });
  }

  const input: PigeonShowcaseInput = { category, name, loftId, description: sanitizeDescriptionHtml(description) };
  const result = await updatePigeonShowcase(showcaseId, input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { id } = await params;
  const showcaseId = Number(id);
  if (!Number.isFinite(showcaseId)) {
    return NextResponse.json({ ok: false, error: "找不到這筆鴿況資料" }, { status: 404 });
  }

  const result = await deletePigeonShowcase(showcaseId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
