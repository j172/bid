import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/apiAuth";
import {
  createClubAwardAlbum,
  isClubAwardPageSize,
  listClubAwardAlbums,
} from "@/lib/pigeons/clubAwardPigeons";
import {
  parseOptionalClubAwardSortOrder,
  validateClubAwardAlbumName,
} from "@/lib/pigeons/clubAwardPigeonsValidation";

async function extractAlbumFields(request: Request): Promise<{ name: string; sortOrder: number | undefined } | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const rawName = form.get("name");
    const rawSortOrder = form.get("sortOrder");
    const sortOrder = rawSortOrder === null ? undefined : parseOptionalClubAwardSortOrder(rawSortOrder);
    if (sortOrder === null) return null;
    return { name: typeof rawName === "string" ? rawName : "", sortOrder };
  }
  try {
    const body = (await request.json()) as { name?: unknown; sortOrder?: unknown } | null;
    if (!body || (body.name !== undefined && typeof body.name !== "string")) return null;
    const sortOrder = parseOptionalClubAwardSortOrder(body.sortOrder);
    if (sortOrder === null) return null;
    return { name: typeof body.name === "string" ? body.name : "", sortOrder };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const pageSize = isClubAwardPageSize(pageSizeRaw) ? pageSizeRaw : undefined;

  const { items, total } = await listClubAwardAlbums({ search, page, pageSize });
  return NextResponse.json({ ok: true, items, total });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const fields = await extractAlbumFields(request);
  if (fields === null) {
    return NextResponse.json({ ok: false, error: "無效的請求格式" }, { status: 400 });
  }

  const name = fields.name.trim();
  const validation = validateClubAwardAlbumName(name);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const result = await createClubAwardAlbum(name, fields.sortOrder);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
