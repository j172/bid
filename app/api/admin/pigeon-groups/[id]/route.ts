import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { deletePigeonGroup, getPigeonGroup, updatePigeonGroup } from "@/lib/pigeonGroups";
import { parseIdParam } from "@/lib/routeParams";

interface PigeonGroupPayload {
  name?: unknown;
  address?: unknown;
  lat?: unknown;
  lng?: unknown;
  chairmanName?: unknown;
  chairmanPhone?: unknown;
  secretaryName?: unknown;
  secretaryPhone?: unknown;
  websiteUrl?: unknown;
  pigeonTrackingUrl?: unknown;
  sourceUrl?: unknown;
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return typeof value === "string" ? value : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const groupId = parseIdParam(id);
  if (groupId === null) {
    return NextResponse.json({ ok: false, error: "無效的鴿會 ID" }, { status: 404 });
  }

  const group = await getPigeonGroup(groupId);
  if (!group) {
    return NextResponse.json({ ok: false, error: "找不到該鴿會資料" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, group });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const groupId = parseIdParam(id);
  if (groupId === null) {
    return NextResponse.json({ ok: false, error: "無效的鴿會 ID" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "無效的請求格式" }, { status: 400 });
  }

  const {
    name,
    address,
    lat,
    lng,
    chairmanName,
    chairmanPhone,
    secretaryName,
    secretaryPhone,
    websiteUrl,
    pigeonTrackingUrl,
    sourceUrl,
  } = (body ?? {}) as PigeonGroupPayload;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "請輸入鴿會名稱" }, { status: 400 });
  }

  for (const [label, value] of [
    ["地址", address],
    ["會長姓名", chairmanName],
    ["會長電話", chairmanPhone],
    ["秘書姓名", secretaryName],
    ["秘書電話", secretaryPhone],
    ["官網網址", websiteUrl],
    ["即時返鴿查詢網址", pigeonTrackingUrl],
    ["原文網址", sourceUrl],
  ] as const) {
    if (value !== undefined && value !== null && typeof value !== "string") {
      return NextResponse.json({ ok: false, error: `${label}格式錯誤` }, { status: 400 });
    }
  }

  let parsedLat: number | null = null;
  if (lat !== undefined && lat !== null && lat !== "") {
    parsedLat = Number(lat);
    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      return NextResponse.json({ ok: false, error: "緯度必須介於 -90 到 90 之間" }, { status: 400 });
    }
  }

  let parsedLng: number | null = null;
  if (lng !== undefined && lng !== null && lng !== "") {
    parsedLng = Number(lng);
    if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      return NextResponse.json({ ok: false, error: "經度必須介於 -180 到 180 之間" }, { status: 400 });
    }
  }

  const result = await updatePigeonGroup(groupId, {
    name,
    address: optionalString(address),
    lat: parsedLat,
    lng: parsedLng,
    chairmanName: optionalString(chairmanName),
    chairmanPhone: optionalString(chairmanPhone),
    secretaryName: optionalString(secretaryName),
    secretaryPhone: optionalString(secretaryPhone),
    websiteUrl: optionalString(websiteUrl),
    pigeonTrackingUrl: optionalString(pigeonTrackingUrl),
    sourceUrl: typeof sourceUrl === "string" ? sourceUrl : "",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const groupId = parseIdParam(id);
  if (groupId === null) {
    return NextResponse.json({ ok: false, error: "無效的鴿會 ID" }, { status: 404 });
  }

  const result = await deletePigeonGroup(groupId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
