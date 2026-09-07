import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countHomepageVideos,
  createHomepageVideo,
  deleteHomepageVideo,
  getHomepageVideo,
  HOMEPAGE_VIDEOS_MAX,
  listHomepageVideos,
  updateHomepageVideo,
} from "./homepageVideos";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

vi.mock("@/lib/cache", () => ({
  invalidateCache: vi.fn(),
}));

beforeEach(() => {
  queryMock.mockReset();
});

const ROW = {
  id: 1,
  title: "翔水賽鴿 精選影音",
  youtube_url: "https://www.youtube.com/watch?v=vy4lQXW-TLM",
  video_id: "vy4lQXW-TLM",
  sort_order: 0,
  is_active: 1,
  created_at: new Date("2026-03-01T00:00:00Z"),
  updated_at: new Date("2026-03-02T00:00:00Z"),
};

describe("listHomepageVideos", () => {
  it("returns all items ordered by sort_order ASC, id ASC by default", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    const items = await listHomepageVideos();

    expect(items).toEqual([
      {
        id: 1,
        title: "翔水賽鴿 精選影音",
        youtubeUrl: "https://www.youtube.com/watch?v=vy4lQXW-TLM",
        videoId: "vy4lQXW-TLM",
        sortOrder: 0,
        isActive: true,
        createdAt: ROW.created_at,
        updatedAt: ROW.updated_at,
      },
    ]);
    expect(queryMock.mock.calls[0][0]).toContain("ORDER BY sort_order ASC, id ASC");
    expect(queryMock.mock.calls[0][0]).not.toContain("WHERE is_active = 1");
  });

  it("filters activeOnly when requested", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    await listHomepageVideos({ activeOnly: true });

    expect(queryMock.mock.calls[0][0]).toContain("WHERE is_active = 1");
  });
});

describe("getHomepageVideo", () => {
  it("returns mapped item when found", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    const item = await getHomepageVideo(1);
    expect(item?.videoId).toBe("vy4lQXW-TLM");
  });

  it("returns null when not found", async () => {
    queryMock.mockResolvedValueOnce([[]]);

    const item = await getHomepageVideo(999);
    expect(item).toBeNull();
  });
});

describe("countHomepageVideos", () => {
  it("returns current video count", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 4 }]]);
    const count = await countHomepageVideos();
    expect(count).toBe(4);
  });
});

describe("createHomepageVideo", () => {
  it("rejects empty title", async () => {
    const res = await createHomepageVideo({
      title: "   ",
      youtubeUrl: "https://www.youtube.com/watch?v=vy4lQXW-TLM",
    });
    expect(res).toEqual({ ok: false, error: "請輸入影片標題" });
  });

  it("rejects invalid YouTube URL", async () => {
    const res = await createHomepageVideo({
      title: "測試標題",
      youtubeUrl: "https://vimeo.com/123456",
    });
    expect(res).toEqual({
      ok: false,
      error: "無效的 YouTube 網址，請確認包含正確的影片 ID",
    });
  });

  it("rejects when already at HOMEPAGE_VIDEOS_MAX (6)", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: HOMEPAGE_VIDEOS_MAX }]]);

    const res = await createHomepageVideo({
      title: "第 7 則影音",
      youtubeUrl: "https://youtu.be/vy4lQXW-TLM",
    });

    expect(res).toEqual({
      ok: false,
      error: `最多只能設定 ${HOMEPAGE_VIDEOS_MAX} 則指定影音，請先刪除或編輯現有影音`,
    });
  });

  it("creates item successfully, extracting 11-char videoId and defaulting sortOrder", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 2 }]]); // count check
    queryMock.mockResolvedValueOnce([[{ nextOrder: 2 }]]); // max sortOrder
    queryMock.mockResolvedValueOnce([{ insertId: 3 }]); // insert

    const res = await createHomepageVideo({
      title: "第二部影片",
      youtubeUrl: "https://youtu.be/uZujgOcOICs",
    });

    expect(res).toEqual({ ok: true, id: 3 });
    const insertCall = queryMock.mock.calls[2];
    expect(insertCall[0]).toContain("INSERT INTO homepage_videos");
    expect(insertCall[1]).toEqual([
      "第二部影片",
      "https://youtu.be/uZujgOcOICs",
      "uZujgOcOICs",
      2,
      1,
    ]);
  });
});

describe("updateHomepageVideo", () => {
  it("updates title, videoId and sortOrder successfully", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await updateHomepageVideo(1, {
      title: "更新標題",
      youtubeUrl: "https://www.youtube.com/shorts/kJ0_gK3zCsM",
      sortOrder: 1,
      isActive: false,
    });

    expect(res).toEqual({ ok: true });
    expect(queryMock.mock.calls[0][1]).toEqual([
      "更新標題",
      "https://www.youtube.com/shorts/kJ0_gK3zCsM",
      "kJ0_gK3zCsM",
      1,
      0,
      1,
    ]);
  });

  it("returns error when record does not exist", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await updateHomepageVideo(999, {
      title: "更新標題",
      youtubeUrl: "https://www.youtube.com/watch?v=kJ0_gK3zCsM",
      sortOrder: 0,
      isActive: true,
    });

    expect(res).toEqual({ ok: false, error: "找不到該影音項目" });
  });
});

describe("deleteHomepageVideo", () => {
  it("deletes record successfully", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const res = await deleteHomepageVideo(1);
    expect(res).toEqual({ ok: true });
    expect(queryMock.mock.calls[0][0]).toBe("DELETE FROM homepage_videos WHERE id = ?");
    expect(queryMock.mock.calls[0][1]).toEqual([1]);
  });

  it("returns error when deleting non-existent record", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await deleteHomepageVideo(999);
    expect(res).toEqual({ ok: false, error: "找不到該影音項目" });
  });
});

