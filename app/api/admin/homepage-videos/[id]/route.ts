import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import {
  deleteHomepageVideo,
  getHomepageVideo,
  updateHomepageVideo,
} from "@/lib/homepageVideos";
import { parseIdParam } from "@/lib/routeParams";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const videoId = parseIdParam(id);
  if (videoId === null) {
    return NextResponse.json({ ok: false, error: "無效的影音 ID" }, { status: 404 });
  }

  const video = await getHomepageVideo(videoId);
  if (!video) {
    return NextResponse.json({ ok: false, error: "找不到該影音項目" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, video });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const { id } = await params;
  const videoId = parseIdParam(id);
  if (videoId === null) {
    return NextResponse.json({ ok: false, error: "無效的影音 ID" }, { status: 404 });
  }

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

  const parsedSortOrder = Number(sortOrder);
  if (!Number.isFinite(parsedSortOrder) || !Number.isInteger(parsedSortOrder) || parsedSortOrder < 0) {
    return NextResponse.json({ ok: false, error: "排序必須是不小於 0 的整數" }, { status: 400 });
  }

  const parsedIsActive = Boolean(isActive);

  const result = await updateHomepageVideo(videoId, {
    title,
    youtubeUrl,
    sortOrder: parsedSortOrder,
    isActive: parsedIsActive,
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
  const videoId = parseIdParam(id);
  if (videoId === null) {
    return NextResponse.json({ ok: false, error: "無效的影音 ID" }, { status: 404 });
  }

  const result = await deleteHomepageVideo(videoId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

