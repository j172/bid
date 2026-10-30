import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/apiAuth";
import {
  createClubAwardAlbum,
  isClubAwardPageSize,
  listClubAwardAlbums,
} from "@/lib/pigeons/clubAwardPigeons";
import { validateClubAwardAlbumName } from "@/lib/pigeons/clubAwardPigeonsValidation";

async function extractAlbumName(request: Request): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    const raw = form.get("name");
    return typeof raw === "string" ? raw : "";
  }
  try {
    const body = (await request.json()) as { name?: unknown } | null;
    return typeof body?.name === "string" ? body.name : "";
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

  const rawName = await extractAlbumName(request);
  if (rawName === null) {
    return NextResponse.json({ ok: false, error: "無效的請求格式" }, { status: 400 });
  }

  const name = rawName.trim();
  const validation = validateClubAwardAlbumName(name);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const result = await createClubAwardAlbum(name);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
