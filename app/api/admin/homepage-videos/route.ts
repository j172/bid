import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { createHomepageVideo, listHomepageVideos } from "@/lib/homepageVideos";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const videos = await listHomepageVideos();
  return NextResponse.json({ ok: true, videos });
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

  const { title, youtubeUrl, sortOrder, isActive } = (body ?? {}) as {
    title?: unknown;
    youtubeUrl?: unknown;
    sortOrder?: unknown;
    isActive?: unknown;
  };

  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ ok: false, error: "請輸入影片標題" }, { status: 400 });
  }

  if (typeof youtubeUrl !== "string" || !youtubeUrl.trim()) {
    return NextResponse.json({ ok: false, error: "請輸入 YouTube 影片網址" }, { status: 400 });
  }

  let parsedSortOrder: number | undefined;
  if (sortOrder !== undefined && sortOrder !== null && sortOrder !== "") {
    parsedSortOrder = Number(sortOrder);
    if (!Number.isFinite(parsedSortOrder) || !Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
      return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
    }
  }

  if (isActive !== undefined && typeof isActive !== "boolean") {
    return NextResponse.json({ ok: false, error: "啟用狀態格式錯誤" }, { status: 400 });
  }

  const parsedIsActive = isActive;

  const result = await createHomepageVideo({
    title,
    youtubeUrl,
    sortOrder: parsedSortOrder,
    isActive: parsedIsActive,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}

