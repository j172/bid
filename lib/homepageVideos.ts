import { getDb } from "@/lib/db";
import { extractYouTubeId } from "@/lib/youtubeEmbed";
import { invalidateCache } from "@/lib/cache";
import type { PoolConnection } from "mysql2/promise";

export const HOMEPAGE_VIDEOS_MAX = 6;
const YOUTUBE_FEED_CACHE_KEY = "socialMedia:youtubeFeed";
const HOMEPAGE_VIDEOS_LOCK_NAME = "bid:homepage-videos:write";
const HOMEPAGE_VIDEOS_LOCK_TIMEOUT_SECONDS = 5;

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

async function hasDuplicateVideoId(
  db: Pick<PoolConnection, "query">,
  videoId: string,
  excludeId?: number,
): Promise<boolean> {
  const [rows] = await db.query(
    excludeId === undefined
      ? "SELECT id FROM homepage_videos WHERE video_id = ? LIMIT 1"
      : "SELECT id FROM homepage_videos WHERE video_id = ? AND id <> ? LIMIT 1",
    excludeId === undefined ? [videoId] : [videoId, excludeId],
  );
  return (rows as { id: number }[]).length > 0;
}

async function acquireWriteLock(connection: PoolConnection): Promise<void> {
  const [rows] = await connection.query("SELECT GET_LOCK(?, ?) AS acquired", [
    HOMEPAGE_VIDEOS_LOCK_NAME,
    HOMEPAGE_VIDEOS_LOCK_TIMEOUT_SECONDS,
  ]);
  const acquired = (rows as { acquired: number | null }[])[0]?.acquired;
  if (acquired !== 1) throw new Error("無法取得首頁影音編輯鎖，請稍後再試");
}

async function releaseWriteLock(connection: PoolConnection): Promise<void> {
  await connection.query("SELECT RELEASE_LOCK(?)", [HOMEPAGE_VIDEOS_LOCK_NAME]);
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

  const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : 1;
  const db = await getDb();
  const connection = await db.getConnection();
  let committed = false;
  let lockAcquired = false;
  try {
    await connection.beginTransaction();
    await acquireWriteLock(connection);
    lockAcquired = true;

    if (await hasDuplicateVideoId(connection, videoId)) {
      await connection.rollback();
      return { ok: false, error: "這部 YouTube 影片已存在，請勿重複指定" };
    }

    if (isActive === 1) {
      const [countRows] = await connection.query(
        "SELECT COUNT(*) AS cnt FROM homepage_videos WHERE is_active = 1",
      );
      const activeCount = (countRows as { cnt: number }[])[0]?.cnt ?? 0;
      if (activeCount >= HOMEPAGE_VIDEOS_MAX) {
        await connection.rollback();
        return {
          ok: false,
          error: `最多只能設定 ${HOMEPAGE_VIDEOS_MAX} 則啟用中的指定影音，請先停用其他影音`,
        };
      }
    }

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const [orderRows] = await connection.query(
        "SELECT COALESCE(MAX(sort_order) + 1, 0) AS nextOrder FROM homepage_videos",
      );
      sortOrder = (orderRows as { nextOrder: number }[])[0]?.nextOrder ?? 0;
    }

    const [result] = await connection.query(
      `INSERT INTO homepage_videos (title, youtube_url, video_id, sort_order, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, youtubeUrl, videoId, sortOrder, isActive],
    );
    await connection.commit();
    committed = true;

    invalidateCache(YOUTUBE_FEED_CACHE_KEY);
    const insertId = (result as { insertId: number }).insertId;
    return { ok: true, id: insertId };
  } catch (error) {
    if (!committed) await connection.rollback();
    if (isDuplicateVideoIdError(error)) {
      return { ok: false, error: "這部 YouTube 影片已存在，請勿重複指定" };
    }
    if (error instanceof Error && error.message === "無法取得首頁影音編輯鎖，請稍後再試") {
      return { ok: false, error: error.message };
    }
    throw error;
  } finally {
    if (lockAcquired) await releaseWriteLock(connection);
    connection.release();
  }
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

  const db = await getDb();
  const connection = await db.getConnection();
  let committed = false;
  let lockAcquired = false;
  try {
    await connection.beginTransaction();
    await acquireWriteLock(connection);
    lockAcquired = true;

    const [existingRows] = await connection.query(
      "SELECT id FROM homepage_videos WHERE id = ? FOR UPDATE",
      [id],
    );
    if ((existingRows as { id: number }[]).length === 0) {
      await connection.rollback();
      return { ok: false, error: "找不到該影音項目" };
    }

    if (await hasDuplicateVideoId(connection, videoId, id)) {
      await connection.rollback();
      return { ok: false, error: "這部 YouTube 影片已存在，請勿重複指定" };
    }

    if (input.isActive) {
      const [countRows] = await connection.query(
        "SELECT COUNT(*) AS cnt FROM homepage_videos WHERE is_active = 1 AND id <> ?",
        [id],
      );
      const activeCount = (countRows as { cnt: number }[])[0]?.cnt ?? 0;
      if (activeCount >= HOMEPAGE_VIDEOS_MAX) {
        await connection.rollback();
        return {
          ok: false,
          error: `最多只能設定 ${HOMEPAGE_VIDEOS_MAX} 則啟用中的指定影音，請先停用其他影音`,
        };
      }
    }

    const [result] = await connection.query(
      `UPDATE homepage_videos
       SET title = ?, youtube_url = ?, video_id = ?, sort_order = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [title, youtubeUrl, videoId, input.sortOrder, input.isActive ? 1 : 0, id],
    );
    void result;
    await connection.commit();
    committed = true;

    invalidateCache(YOUTUBE_FEED_CACHE_KEY);
    return { ok: true };
  } catch (error) {
    if (!committed) await connection.rollback();
    if (isDuplicateVideoIdError(error)) {
      return { ok: false, error: "這部 YouTube 影片已存在，請勿重複指定" };
    }
    if (error instanceof Error && error.message === "無法取得首頁影音編輯鎖，請稍後再試") {
      return { ok: false, error: error.message };
    }
    throw error;
  } finally {
    if (lockAcquired) await releaseWriteLock(connection);
    connection.release();
  }
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

