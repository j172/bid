import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { createPigeonStation, listPigeonStations } from "@/lib/pigeonStations";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const stations = await listPigeonStations();
  return NextResponse.json({ ok: true, stations });
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

  if (typeof name !== "string") {
    return NextResponse.json({ ok: false, error: "請輸入取鴿站名稱" }, { status: 400 });
  }
  if (typeof phone !== "string") {
    return NextResponse.json({ ok: false, error: "請輸入聯絡電話" }, { status: 400 });
  }
  if (typeof address !== "string") {
    return NextResponse.json({ ok: false, error: "請輸入地址" }, { status: 400 });
  }
  if (typeof sourceUrl !== "string") {
    return NextResponse.json({ ok: false, error: "請輸入資料來源網址" }, { status: 400 });
  }
  if (lat !== null && lat !== undefined && typeof lat !== "number") {
    return NextResponse.json({ ok: false, error: "緯度格式錯誤" }, { status: 400 });
  }
  if (lng !== null && lng !== undefined && typeof lng !== "number") {
    return NextResponse.json({ ok: false, error: "經度格式錯誤" }, { status: 400 });
  }

  const result = await createPigeonStation({
    name,
    phone,
    address,
    sourceUrl,
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
