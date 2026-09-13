// lib/pigeonGroups.ts is raw-SQL CRUD (no ORM, see its own header comment),
// modeled on lib/pigeonStations.test.ts: mock @/lib/db's getDb() and assert
// on the SQL/params each function sends plus how it maps mysql2's raw
// rows/results back into the module's public shapes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPigeonGroup,
  deletePigeonGroup,
  getPigeonGroup,
  listPigeonGroups,
  updatePigeonGroup,
} from "./pigeonGroups";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

const ROW = {
  id: 1,
  name: "新竹東區聯合會",
  address: "新竹縣竹東鎮竹美路二段101巷旁",
  lat: "24.7945127",
  lng: "121.0256927",
  chairman_name: "鄭永清",
  chairman_phone: "03-577-5706、0932-118-369",
  secretary_name: "蔡燦龍",
  secretary_phone: "03-534-0305、0952-196-180",
  website_url: "http://www.bigwinner.idv.tw/pig_congress/east/east.html",
  pigeon_tracking_url: "http://webfun.benzing.com.tw",
  source_url: "https://www.cb-pigeon.com/group/view/100",
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
};

describe("listPigeonGroups", () => {
  it("orders by name ASC, id ASC and maps snake_case rows (including string DECIMAL lat/lng) to the public shape", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    const groups = await listPigeonGroups();

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY name ASC, id ASC"));
    expect(groups).toEqual([
      {
        id: 1,
        name: "新竹東區聯合會",
        address: "新竹縣竹東鎮竹美路二段101巷旁",
        lat: 24.7945127,
        lng: 121.0256927,
        chairmanName: "鄭永清",
        chairmanPhone: "03-577-5706、0932-118-369",
        secretaryName: "蔡燦龍",
        secretaryPhone: "03-534-0305、0952-196-180",
        websiteUrl: "http://www.bigwinner.idv.tw/pig_congress/east/east.html",
        pigeonTrackingUrl: "http://webfun.benzing.com.tw",
        sourceUrl: "https://www.cb-pigeon.com/group/view/100",
        createdAt: ROW.created_at,
        updatedAt: ROW.updated_at,
      },
    ]);
  });

  it("maps a NULL lat/lng (failed geocode) through as null rather than 0", async () => {
    queryMock.mockResolvedValueOnce([[{ ...ROW, lat: null, lng: null }]]);

    const [group] = await listPigeonGroups();

    expect(group.lat).toBeNull();
    expect(group.lng).toBeNull();
  });

  it("maps missing optional fields (no secretary, no website) through as null", async () => {
    queryMock.mockResolvedValueOnce([
      [{ ...ROW, secretary_name: null, secretary_phone: null, website_url: null, pigeon_tracking_url: null }],
    ]);

    const [group] = await listPigeonGroups();

    expect(group.secretaryName).toBeNull();
    expect(group.secretaryPhone).toBeNull();
    expect(group.websiteUrl).toBeNull();
    expect(group.pigeonTrackingUrl).toBeNull();
  });
});

describe("getPigeonGroup", () => {
  it("returns the mapped group when found", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);
    const group = await getPigeonGroup(1);
    expect(group?.name).toBe("新竹東區聯合會");
  });

  it("returns null when not found", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    const group = await getPigeonGroup(999);
    expect(group).toBeNull();
  });
});

const VALID_INPUT = {
  name: "新竹東區聯合會",
  address: "新竹縣竹東鎮竹美路二段101巷旁",
  lat: 24.7945127,
  lng: 121.0256927,
  chairmanName: "鄭永清",
  chairmanPhone: "03-577-5706、0932-118-369",
  secretaryName: "蔡燦龍",
  secretaryPhone: "03-534-0305、0952-196-180",
  websiteUrl: "http://www.bigwinner.idv.tw/pig_congress/east/east.html",
  pigeonTrackingUrl: "http://webfun.benzing.com.tw",
  sourceUrl: "https://www.cb-pigeon.com/group/view/100",
};

describe("createPigeonGroup", () => {
  it("rejects an empty name without querying the database", async () => {
    const result = await createPigeonGroup({ ...VALID_INPUT, name: "   " });
    expect(result).toEqual({ ok: false, error: "請輸入鴿會名稱" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range latitude", async () => {
    const result = await createPigeonGroup({ ...VALID_INPUT, lat: 91 });
    expect(result).toEqual({ ok: false, error: "緯度必須介於 -90 到 90 之間" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("allows a null lat/lng (unresolved geocode)", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 5 }]);
    const result = await createPigeonGroup({ ...VALID_INPUT, lat: null, lng: null });
    expect(result).toEqual({ ok: true, id: 5 });
  });

  it("allows a fully-optional group (no chairman/secretary/website/tracking link)", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 8 }]);
    const result = await createPigeonGroup({
      name: "手動新增鴿會",
      sourceUrl: "",
    });
    expect(result).toEqual({ ok: true, id: 8 });
    expect(queryMock.mock.calls[0][1]).toEqual([
      "手動新增鴿會",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "",
    ]);
  });

  it("trims fields and inserts a new row", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 7 }]);
    const result = await createPigeonGroup({ ...VALID_INPUT, name: "  新竹東區聯合會  " });
    expect(result).toEqual({ ok: true, id: 7 });
    expect(queryMock.mock.calls[0][0]).toContain("INSERT INTO pigeon_groups");
    expect(queryMock.mock.calls[0][1][0]).toBe("新竹東區聯合會");
  });

  it("rejects a chairman name over the length limit", async () => {
    const result = await createPigeonGroup({ ...VALID_INPUT, chairmanName: "a".repeat(101) });
    expect(result).toEqual({ ok: false, error: "會長姓名上限 100 字" });
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("updatePigeonGroup", () => {
  it("returns ok:false when no row was affected", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await updatePigeonGroup(999, VALID_INPUT);
    expect(result).toEqual({ ok: false, error: "找不到該鴿會資料" });
  });

  it("updates an existing row", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await updatePigeonGroup(1, VALID_INPUT);
    expect(result).toEqual({ ok: true });
    expect(queryMock.mock.calls[0][0]).toContain("UPDATE pigeon_groups");
  });
});

describe("deletePigeonGroup", () => {
  it("returns ok:false when no row was affected", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await deletePigeonGroup(999);
    expect(result).toEqual({ ok: false, error: "找不到該鴿會資料" });
  });

  it("deletes an existing row", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await deletePigeonGroup(1);
    expect(result).toEqual({ ok: true });
  });
});
