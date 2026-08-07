import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createPigeonShowcase,
  isPigeonShowcasePageSize,
  listPigeonShowcase,
  type PigeonShowcaseInput,
} from "@/lib/pigeonShowcase";
import {
  isPigeonShowcaseCategory,
  validatePigeonShowcaseDescription,
  validatePigeonShowcaseName,
} from "@/lib/pigeonShowcaseValidation";
import { sanitizeDescriptionHtml } from "@/lib/sanitizeDescriptionHtml";

// Admin list view — matches the filters issue #54 asks for: category
// dropdown, name substring search, loft dropdown, selectable page size
// (30/50/100). No JOIN-only public equivalent lives here; the public
// category list page (app/[locale]/pigeon-showcase/page.tsx) calls
// listPigeonShowcase directly (server component), same as every other
// public page in this app reading straight from lib/*.ts.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const categoryRaw = searchParams.get("category") ?? "";
  const category = isPigeonShowcaseCategory(categoryRaw) ? categoryRaw : undefined;
  const search = searchParams.get("search")?.trim() || undefined;
  const loftIdRaw = searchParams.get("loftId");
  const loftId = loftIdRaw && Number.isFinite(Number(loftIdRaw)) ? Number(loftIdRaw) : undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const pageSize = isPigeonShowcasePageSize(pageSizeRaw) ? pageSizeRaw : undefined;

  const { items, total } = await listPigeonShowcase({ category, search, loftId, page, pageSize });
  return NextResponse.json({ ok: true, items, total });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "請先登入" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "僅限管理員" }, { status: 403 });
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
  const result = await createPigeonShowcase(input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
