import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClubAwardAlbum,
  createClubAwardPigeon,
  deleteClubAwardAlbum,
  deleteClubAwardPigeon,
  getClubAwardAlbumById,
  getClubAwardPigeonById,
  isClubAwardPageSize,
  listAllClubAwardAlbums,
  listClubAwardAlbums,
  listClubAwardPigeons,
  listLatestClubAwardAlbums,
  listLatestClubAwardPigeonsByAlbum,
  listTopClubAwardAlbums,
  updateClubAwardAlbum,
  updateClubAwardPigeon,
  updateClubAwardPigeonDescription,
} from "./clubAwardPigeons";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

const ALBUM_ROW = {
  id: 10,
  name: "2026 春季北海聯合會",
  sort_order: 2,
  pigeon_count: 3,
  cover_image_file_name: "cover1.webp",
  created_at: new Date("2026-03-01T00:00:00Z"),
  updated_at: new Date("2026-03-02T00:00:00Z"),
};

const PIGEON_ROW = {
  id: 101,
  album_id: 10,
  sort_order: 4,
  album_title: "2026 春季北海聯合會",
  category: "award",
  name: "北海綜合冠軍",
  loft_id: 5,
  loft_title: "石君鴿舍",
  photo_source: "三豐攝影",
  image_file_name: "pigeon101.webp",
  description: "<p>五關綜合冠軍</p>",
  created_at: new Date("2026-03-03T00:00:00Z"),
  updated_at: new Date("2026-03-04T00:00:00Z"),
};

describe("isClubAwardPageSize", () => {
  it("accepts 30, 50, 100 and rejects others", () => {
    expect(isClubAwardPageSize(30)).toBe(true);
    expect(isClubAwardPageSize(50)).toBe(true);
    expect(isClubAwardPageSize(100)).toBe(true);
    expect(isClubAwardPageSize(20)).toBe(false);
  });
});

describe("club_award_albums CRUD", () => {
  it("lists albums with optional search and pagination, mapping stats columns", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    queryMock.mockResolvedValueOnce([[ALBUM_ROW]]);

    const { items, total } = await listClubAwardAlbums({ search: "北海", page: 1, pageSize: 30 });

    expect(total).toBe(1);
    expect(queryMock.mock.calls[0][0]).toContain("WHERE caa.name LIKE ?");
    expect(queryMock.mock.calls[0][1]).toEqual(["%北海%"]);
    expect(items).toEqual([
      {
        id: 10,
        name: "2026 春季北海聯合會",
        sortOrder: 2,
        pigeonCount: 3,
        coverImageFileName: "cover1.webp",
        createdAt: ALBUM_ROW.created_at,
        updatedAt: ALBUM_ROW.updated_at,
      },
    ]);
  });

  it("keeps latest albums chronological and lists curated albums by sort order", async () => {
    queryMock.mockResolvedValueOnce([[ALBUM_ROW]]);
    const latest = await listLatestClubAwardAlbums(6);
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY caa.created_at DESC, caa.id DESC LIMIT ?"), [
      6,
    ]);
    expect(latest).toHaveLength(1);

    queryMock.mockResolvedValueOnce([[ALBUM_ROW]]);
    const top = await listTopClubAwardAlbums(6);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY caa.sort_order ASC, caa.id ASC LIMIT ?"),
      [6],
    );
    expect(top[0].sortOrder).toBe(2);

    queryMock.mockResolvedValueOnce([[ALBUM_ROW]]);
    const all = await listAllClubAwardAlbums();
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY caa.sort_order ASC, caa.id ASC"));
    expect(all).toHaveLength(1);
  });

  it("gets album by id or returns null when missing", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    expect(await getClubAwardAlbumById(999)).toBeNull();

    queryMock.mockResolvedValueOnce([[ALBUM_ROW]]);
    const album = await getClubAwardAlbumById(10);
    expect(album?.name).toBe("2026 春季北海聯合會");
  });

  it("appends unspecified albums after the current maximum and honors explicit sort values", async () => {
    queryMock.mockResolvedValueOnce([[{ max_sort_order: 8 }]]);
    queryMock.mockResolvedValueOnce([{ insertId: 15 }]);
    expect(await createClubAwardAlbum("新相簿")).toEqual({ ok: true, id: 15 });
    expect(queryMock).toHaveBeenLastCalledWith(
      "INSERT INTO club_award_albums (name, sort_order, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
      ["新相簿", 9],
    );

    queryMock.mockResolvedValueOnce([[{ max_sort_order: -1 }]]);
    queryMock.mockResolvedValueOnce([{ insertId: 17 }]);
    expect(await createClubAwardAlbum("空相簿排序")).toEqual({ ok: true, id: 17 });
    expect(queryMock).toHaveBeenLastCalledWith(
      "INSERT INTO club_award_albums (name, sort_order, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
      ["空相簿排序", 0],
    );

    queryMock.mockResolvedValueOnce([{ insertId: 16 }]);
    expect(await createClubAwardAlbum("指定排序", 0)).toEqual({ ok: true, id: 16 });
    expect(queryMock).toHaveBeenLastCalledWith(
      "INSERT INTO club_award_albums (name, sort_order, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
      ["指定排序", 0],
    );

    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect(await updateClubAwardAlbum(15, "更新相簿")).toEqual({ ok: true });
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect(await updateClubAwardAlbum(15, "移至最前", 0)).toEqual({ ok: true });
    expect(queryMock).toHaveBeenLastCalledWith(
      "UPDATE club_award_albums SET name = ?, sort_order = ?, updated_at = NOW() WHERE id = ?",
      ["移至最前", 0, 15],
    );

    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect(await updateClubAwardAlbum(999, "更新相簿")).toEqual({ ok: false, error: "找不到這個相簿" });
  });

  it("prevents deleting an album that still contains pigeons", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 4 }]]);

    const result = await deleteClubAwardAlbum(10);

    expect(result).toEqual({
      ok: false,
      error: "此相簿尚有 4 筆鴿子資料，請先刪除或移轉相簿內的鴿子後再刪除",
    });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("deletes an empty album and handles non-existent album id", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect(await deleteClubAwardAlbum(10)).toEqual({ ok: true });
    expect(queryMock.mock.calls.some(([sql]) => String(sql).startsWith("UPDATE club_award_albums"))).toBe(false);

    queryMock.mockResolvedValueOnce([[{ cnt: 0 }]]);
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect(await deleteClubAwardAlbum(999)).toEqual({ ok: false, error: "找不到這個相簿" });
  });
});

describe("club_award_pigeons CRUD", () => {
  it("lists pigeons filtered by albumId, category, search, and loftId", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    queryMock.mockResolvedValueOnce([[PIGEON_ROW]]);

    const { items, total } = await listClubAwardPigeons({
      albumId: 10,
      category: "award",
      search: "冠軍",
      loftId: 5,
    });

    expect(total).toBe(1);
    expect(queryMock.mock.calls[0][0]).toContain(
      "WHERE cap.album_id = ? AND cap.category = ? AND cap.name LIKE ? AND cap.loft_id = ?",
    );
    expect(queryMock.mock.calls[0][1]).toEqual([10, "award", "%冠軍%", 5]);
    expect(items[0]).toEqual({
      id: 101,
      albumId: 10,
      sortOrder: 4,
      albumTitle: "2026 春季北海聯合會",
      category: "award",
      name: "北海綜合冠軍",
      loftId: 5,
      loftTitle: "石君鴿舍",
      photoSource: "三豐攝影",
      imageFileName: "pigeon101.webp",
      description: "<p>五關綜合冠軍</p>",
      createdAt: PIGEON_ROW.created_at,
      updatedAt: PIGEON_ROW.updated_at,
    });
  });

  it("lists latest pigeons by album and gets pigeon by id", async () => {
    queryMock.mockResolvedValueOnce([[PIGEON_ROW]]);
    const latest = await listLatestClubAwardPigeonsByAlbum(10, 6);
    expect(latest).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("WHERE cap.album_id = ? ORDER BY cap.created_at DESC, cap.id DESC LIMIT ?"),
      [10, 6],
    );

    queryMock.mockResolvedValueOnce([[PIGEON_ROW]]);
    const item = await getClubAwardPigeonById(101);
    expect(item?.albumTitle).toBe("2026 春季北海聯合會");
  });

  it("groups cross-album results by album order and sorts within an explicitly selected album", async () => {
    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    queryMock.mockResolvedValueOnce([[PIGEON_ROW]]);
    await listClubAwardPigeons();
    expect(queryMock.mock.calls[1][0]).toContain(
      "ORDER BY caa.sort_order ASC, caa.id ASC, cap.sort_order ASC, cap.id ASC",
    );

    queryMock.mockResolvedValueOnce([[{ cnt: 1 }]]);
    queryMock.mockResolvedValueOnce([[PIGEON_ROW]]);
    await listClubAwardPigeons({ albumId: 10 });
    expect(queryMock.mock.calls[3][0]).toContain("ORDER BY cap.sort_order ASC, cap.id ASC");
    expect(queryMock.mock.calls[3][0]).not.toContain("caa.sort_order ASC");
  });

  it("rejects createClubAwardPigeon when album does not exist", async () => {
    queryMock.mockResolvedValueOnce([[]]); // albumExists -> false

    const result = await createClubAwardPigeon({
      albumId: 999,
      category: "award",
      name: "冠軍號",
      loftId: null,
      imageFileName: "a.webp",
      description: "<p>d</p>",
    });

    expect(result).toEqual({ ok: false, error: "找不到這個相簿" });
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("allows null loftId for any category and validates partner_loft when loftId is provided", async () => {
    // null loftId for 'award' category succeeds without partner_loft query
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]); // albumExists
    queryMock.mockResolvedValueOnce([[{ max_sort_order: 4 }]]);
    queryMock.mockResolvedValueOnce([{ insertId: 201 }]);

    const createdNoLoft = await createClubAwardPigeon({
      albumId: 10,
      category: "award",
      name: "無鴿舍入賞鴿",
      loftId: null,
      imageFileName: "a.webp",
      description: "<p>d</p>",
    });
    expect(createdNoLoft).toEqual({ ok: true, id: 201 });
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO club_award_pigeons (album_id, sort_order"),
      [10, 5, "award", "無鴿舍入賞鴿", null, null, "a.webp", "<p>d</p>"],
    );

    // non-existent partner_loft is rejected
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]); // albumExists
    queryMock.mockResolvedValueOnce([[]]); // isPartnerLoft -> false
    const badLoft = await createClubAwardPigeon({
      albumId: 10,
      category: "award",
      name: "有鴿舍入賞鴿",
      loftId: 99,
      imageFileName: "a.webp",
      description: "<p>d</p>",
    });
    expect(badLoft).toEqual({ ok: false, error: "找不到這個合作鴿舍" });

    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]); // albumExists
    queryMock.mockResolvedValueOnce([[{ max_sort_order: -1 }]]);
    queryMock.mockResolvedValueOnce([{ insertId: 202 }]);
    expect(
      await createClubAwardPigeon({
        albumId: 10,
        category: "award",
        name: "空相簿排序",
        loftId: null,
        imageFileName: "empty-album.webp",
        description: "",
      }),
    ).toEqual({ ok: true, id: 202 });
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO club_award_pigeons (album_id, sort_order"),
      [10, 0, "award", "空相簿排序", null, null, "empty-album.webp", ""],
    );
  });

  it("updates pigeon, updates description, and deletes pigeon", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]); // albumExists
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]); // isPartnerLoft
    queryMock.mockResolvedValueOnce([[{ album_id: 10, sort_order: 4 }]]); // current sort position
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const updated = await updateClubAwardPigeon(101, {
      albumId: 10,
      category: "imported",
      name: "更新名稱",
      loftId: 5,
      photoSource: "舍內自拍",
      imageFileName: "b.webp",
      description: "<p>updated</p>",
    });
    expect(updated).toEqual({ ok: true });
    expect(queryMock.mock.calls[3][0]).toContain("SET album_id = ?, sort_order = ?, category = ?");
    expect(queryMock.mock.calls[3][1]).toEqual([
      10,
      4,
      "imported",
      "更新名稱",
      5,
      "舍內自拍",
      "b.webp",
      "<p>updated</p>",
      101,
    ]);

    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await updateClubAwardPigeonDescription(101, "<p>desc</p>");
    expect(queryMock).toHaveBeenCalledWith("UPDATE club_award_pigeons SET description = ? WHERE id = ?", [
      "<p>desc</p>",
      101,
    ]);

    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    expect(await deleteClubAwardPigeon(101)).toEqual({ ok: true });

    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    expect(await deleteClubAwardPigeon(999)).toEqual({ ok: false, error: "找不到這筆入賞鴿資料" });
  });

  it("moves an unspecified pigeon to the end of the destination album", async () => {
    queryMock.mockResolvedValueOnce([[{ 1: 1 }]]); // destination album exists
    queryMock.mockResolvedValueOnce([[{ album_id: 10, sort_order: 4 }]]); // current album/sort
    queryMock.mockResolvedValueOnce([[{ max_sort_order: 6 }]]); // target maximum
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await updateClubAwardPigeon(101, {
      albumId: 20,
      category: "award",
      name: "移轉到新相簿",
      loftId: null,
      imageFileName: "moved.webp",
      description: "",
    });

    expect(result).toEqual({ ok: true });
    expect(queryMock).toHaveBeenLastCalledWith(
      expect.stringContaining("SET album_id = ?, sort_order = ?, category = ?"),
      [20, 7, "award", "移轉到新相簿", null, null, "moved.webp", "", 101],
    );
  });

  it("deletes a pigeon without rewriting sibling sort values", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await deleteClubAwardPigeon(101)).toEqual({ ok: true });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith("DELETE FROM club_award_pigeons WHERE id = ?", [101]);
  });
});
