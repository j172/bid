import { getDb } from "@/lib/db";
import { extractYouTubeId } from "@/lib/youtubeEmbed";
import { invalidateCache } from "@/lib/cache";

export const HOMEPAGE_VIDEOS_MAX = 6;
const YOUTUBE_FEED_CACHE_KEY = "socialMedia:youtubeFeed";

export interface HomepageVideo {
  id: number;
  title: string;
  youtubeUrl: string;
  videoId: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewHomepageVideoInput {
  title: string;
  youtubeUrl: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateHomepageVideoInput {
  title: string;
  youtubeUrl: string;
  sortOrder: number;
  isActive: boolean;
}

interface HomepageVideoRow {
  id: number;
  title: string;
  youtube_url: string;
  video_id: string;
  sort_order: number;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: HomepageVideoRow): HomepageVideo {
  return {
    id: row.id,
    title: row.title,
    youtubeUrl: row.youtube_url,
    videoId: row.video_id,
    sortOrder: row.sort_order,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listHomepageVideos(options?: { activeOnly?: boolean }): Promise<HomepageVideo[]> {
  const db = await getDb();
  const conditions: string[] = [];

  if (options?.activeOnly) {
    conditions.push("is_active = 1");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await db.query(
    `SELECT * FROM homepage_videos ${whereClause} ORDER BY sort_order ASC, id ASC`,
  );

  return (rows as HomepageVideoRow[]).map(mapRow);
}

export async function getHomepageVideo(id: number): Promise<HomepageVideo | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT * FROM homepage_videos WHERE id = ? LIMIT 1", [id]);
  const rowList = rows as HomepageVideoRow[];
  if (rowList.length === 0) return null;
  return mapRow(rowList[0]);
}

export async function countHomepageVideos(): Promise<number> {
  const db = await getDb();
  const [rows] = await db.query("SELECT COUNT(*) AS cnt FROM homepage_videos WHERE is_active = 1");
  return (rows as { cnt: number }[])[0]?.cnt ?? 0;
}

function isDuplicateVideoIdError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const dbError = error as { errno?: number; code?: string };
  return dbError.errno === 1062 || dbError.code === "ER_DUP_ENTRY";
}

async function hasDuplicateVideoId(videoId: string, excludeId?: number): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query(
    excludeId === undefined
      ? "SELECT id FROM homepage_videos WHERE video_id = ? LIMIT 1"
      : "SELECT id FROM homepage_videos WHERE video_id = ? AND id <> ? LIMIT 1",
    excludeId === undefined ? [videoId] : [videoId, excludeId],
  );
  return (rows as { id: number }[]).length > 0;
}

function validateSortOrder(sortOrder: number | undefined): string | null {
  if (
    sortOrder !== undefined &&
    (!Number.isInteger(sortOrder) || sortOrder < 0)
  ) {
    return "排序必須是不小於 0 的整數";
  }
  return null;
}

export async function createHomepageVideo(
  input: NewHomepageVideoInput,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "請輸入影片標題" };
  }
  if (title.length > 255) {
    return { ok: false, error: "標題上限 255 字" };
  }

  const youtubeUrl = input.youtubeUrl.trim();
  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    return { ok: false, error: "無效的 YouTube 網址，請確認包含正確的影片 ID" };
  }

  const sortOrderError = validateSortOrder(input.sortOrder);
  if (sortOrderError) return { ok: false, error: sortOrderError };

  if (await hasDuplicateVideoId(videoId)) {
    return { ok: false, error: "這部 YouTube 影片已存在，請勿重複指定" };
  }

  const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : 1;

  const currentCount = isActive === 1 ? await countHomepageVideos() : 0;
  if (currentCount >= HOMEPAGE_VIDEOS_MAX) {
    return {
      ok: false,
      error: `最多只能設定 ${HOMEPAGE_VIDEOS_MAX} 則啟用中的指定影音，請先停用其他影音`,
    };
  }

  const db = await getDb();
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const [orderRows] = await db.query(
      "SELECT COALESCE(MAX(sort_order) + 1, 0) AS nextOrder FROM homepage_videos",
    );
    sortOrder = (orderRows as { nextOrder: number }[])[0]?.nextOrder ?? 0;
  }

  let result: unknown;
  try {
    [result] = await db.query(
      `INSERT INTO homepage_videos (title, youtube_url, video_id, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, youtubeUrl, videoId, sortOrder, isActive],
    );
  } catch (error) {
    if (isDuplicateVideoIdError(error)) {
      return { ok: false, error: "這部 YouTube 影片已存在，請勿重複指定" };
    }
    throw error;
  }

  invalidateCache(YOUTUBE_FEED_CACHE_KEY);

  const insertId = (result as { insertId: number }).insertId;
  return { ok: true, id: insertId };
}

export async function updateHomepageVideo(
  id: number,
  input: UpdateHomepageVideoInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "請輸入影片標題" };
  }
  if (title.length > 255) {
    return { ok: false, error: "標題上限 255 字" };
  }

  const youtubeUrl = input.youtubeUrl.trim();
  const videoId = extractYouTubeId(youtubeUrl);
  if (!videoId) {
    return { ok: false, error: "無效的 YouTube 網址，請確認包含正確的影片 ID" };
  }

  const sortOrderError = validateSortOrder(input.sortOrder);
  if (sortOrderError) return { ok: false, error: sortOrderError };

  if (await hasDuplicateVideoId(videoId, id)) {
    return { ok: false, error: "這部 YouTube 影片已存在，請勿重複指定" };
  }

  const db = await getDb();
  if (input.isActive) {
    const [countRows] = await db.query(
      "SELECT COUNT(*) AS cnt FROM homepage_videos WHERE is_active = 1 AND id <> ?",
      [id],
    );
    const activeCount = (countRows as { cnt: number }[])[0]?.cnt ?? 0;
    if (activeCount >= HOMEPAGE_VIDEOS_MAX) {
      return {
        ok: false,
        error: `最多只能設定 ${HOMEPAGE_VIDEOS_MAX} 則啟用中的指定影音，請先停用其他影音`,
      };
    }
  }

  let result: unknown;
  try {
    [result] = await db.query(
      `UPDATE homepage_videos
       SET title = ?, youtube_url = ?, video_id = ?, sort_order = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, youtubeUrl, videoId, input.sortOrder, input.isActive ? 1 : 0, id],
    );
  } catch (error) {
    if (isDuplicateVideoIdError(error)) {
      return { ok: false, error: "這部 YouTube 影片已存在，請勿重複指定" };
    }
    throw error;
  }

  const affectedRows = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affectedRows === 0) {
    return { ok: false, error: "找不到該影音項目" };
  }

  invalidateCache(YOUTUBE_FEED_CACHE_KEY);
  return { ok: true };
}

export async function deleteHomepageVideo(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();
  const [result] = await db.query("DELETE FROM homepage_videos WHERE id = ?", [id]);

  const affectedRows = (result as { affectedRows?: number }).affectedRows ?? 0;
  if (affectedRows === 0) {
    return { ok: false, error: "找不到該影音項目" };
  }

  invalidateCache(YOUTUBE_FEED_CACHE_KEY);
  return { ok: true };
}

