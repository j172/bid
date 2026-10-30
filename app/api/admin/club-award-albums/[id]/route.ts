import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/apiAuth";
import {
  deleteClubAwardAlbum,
  getClubAwardAlbumById,
  updateClubAwardAlbum,
} from "@/lib/pigeons/clubAwardPigeons";
import { validateClubAwardAlbumName } from "@/lib/pigeons/clubAwardPigeonsValidation";
import { parseIdParam } from "@/lib/shared/api/routeParams";

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

async function handleUpdate(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const albumId = parseIdParam(id);
  if (albumId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個相簿" }, { status: 404 });
  }

  const existing = await getClubAwardAlbumById(albumId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個相簿" }, { status: 404 });
  }

  const rawName = await extractAlbumName(request);
  if (rawName === null) {
    return NextResponse.json({ ok: false, error: "無效的請求格式" }, { status: 400 });
  }

  const name = rawName.trim();
  const validation = validateClubAwardAlbumName(name);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const result = await updateClubAwardAlbum(albumId, name);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleUpdate(request, context);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return handleUpdate(request, context);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const albumId = parseIdParam(id);
  if (albumId === null) {
    return NextResponse.json({ ok: false, error: "找不到這個相簿" }, { status: 404 });
  }

  const existing = await getClubAwardAlbumById(albumId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "找不到這個相簿" }, { status: 404 });
  }

  const result = await deleteClubAwardAlbum(albumId);
  if (!result.ok) {
    const status = result.error.includes("找不到") ? 404 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
