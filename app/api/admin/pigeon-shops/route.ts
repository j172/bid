import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { createPigeonShop, listPigeonShops } from "@/lib/pigeonShops";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const shops = await listPigeonShops();
  return NextResponse.json({ ok: true, shops });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "無效的請求格式" }, { status: 400 });
  }

  const { name, phone, address, lat, lng, sourceUrl } = (body ?? {}) as {
    name?: unknown;
    phone?: unknown;
    address?: unknown;
    lat?: unknown;
    lng?: unknown;
    sourceUrl?: unknown;
  };

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ ok: false, error: "請輸入店名" }, { status: 400 });
  }
  if (phone !== undefined && phone !== null && typeof phone !== "string") {
    return NextResponse.json({ ok: false, error: "電話格式錯誤" }, { status: 400 });
  }
  if (address !== undefined && address !== null && typeof address !== "string") {
    return NextResponse.json({ ok: false, error: "地址格式錯誤" }, { status: 400 });
  }
  if (sourceUrl !== undefined && sourceUrl !== null && typeof sourceUrl !== "string") {
    return NextResponse.json({ ok: false, error: "原文網址格式錯誤" }, { status: 400 });
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

  const result = await createPigeonShop({
    name,
    phone: typeof phone === "string" ? phone : null,
    address: typeof address === "string" ? address : null,
    lat: parsedLat,
    lng: parsedLng,
    sourceUrl: typeof sourceUrl === "string" ? sourceUrl : "",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
