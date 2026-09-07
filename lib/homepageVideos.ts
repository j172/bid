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
  const [rows] = await db.query("SELECT COUNT(*) AS cnt FROM homepage_videos");
  return (rows as { cnt: number }[])[0]?.cnt ?? 0;
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

  const currentCount = await countHomepageVideos();
  if (currentCount >= HOMEPAGE_VIDEOS_MAX) {
    return {
      ok: false,
      error: `最多只能設定 ${HOMEPAGE_VIDEOS_MAX} 則指定影音，請先刪除或編輯現有影音`,
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

  const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : 1;

  const [result] = await db.query(
    `INSERT INTO homepage_videos (title, youtube_url, video_id, sort_order, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [title, youtubeUrl, videoId, sortOrder, isActive],
  );

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

  const db = await getDb();
  const [result] = await db.query(
    `UPDATE homepage_videos
     SET title = ?, youtube_url = ?, video_id = ?, sort_order = ?, is_active = ?, updated_at = NOW()
     WHERE id = ?`,
    [title, youtubeUrl, videoId, input.sortOrder, input.isActive ? 1 : 0, id],
  );

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

