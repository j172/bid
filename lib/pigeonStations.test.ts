// lib/pigeonStations.ts is raw-SQL CRUD (no ORM, see its own header
// comment), modeled on lib/homepageSections.test.ts: mock @/lib/db's
// getDb() and assert on the SQL/params each function sends plus how it
// maps mysql2's raw rows/results back into the module's public shapes.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPigeonStation,
  deletePigeonStation,
  getPigeonStationById,
  listPigeonStations,
  updatePigeonStation,
} from "./pigeonStations";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  getDb: async () => ({ query: queryMock }),
}));

beforeEach(() => {
  queryMock.mockReset();
});

const ROW = {
  id: 1,
  name: "三重站",
  phone: "02-29724082",
  address: "三重區河邊北街166號",
  lat: "25.0637890",
  lng: "121.4930120",
  source_url: "https://nicepigeon.com/news_detail.php?id=16",
  created_at: new Date("2026-01-01T00:00:00Z"),
  updated_at: new Date("2026-01-02T00:00:00Z"),
};

describe("listPigeonStations", () => {
  it("orders by name ASC, id ASC and maps snake_case rows (including string DECIMAL lat/lng) to the public shape", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);

    const stations = await listPigeonStations();

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("ORDER BY name ASC, id ASC"));
    expect(stations).toEqual([
      {
        id: 1,
        name: "三重站",
        phone: "02-29724082",
        address: "三重區河邊北街166號",
        lat: 25.063789,
        lng: 121.493012,
        sourceUrl: "https://nicepigeon.com/news_detail.php?id=16",
        createdAt: ROW.created_at,
        updatedAt: ROW.updated_at,
      },
    ]);
  });

  it("maps a NULL lat/lng (failed geocode) through as null rather than 0", async () => {
    queryMock.mockResolvedValueOnce([[{ ...ROW, lat: null, lng: null }]]);

    const [station] = await listPigeonStations();

    expect(station.lat).toBeNull();
    expect(station.lng).toBeNull();
  });
});

describe("getPigeonStationById", () => {
  it("returns the mapped station when found", async () => {
    queryMock.mockResolvedValueOnce([[ROW]]);
    const station = await getPigeonStationById(1);
    expect(station?.name).toBe("三重站");
  });

  it("returns null when not found", async () => {
    queryMock.mockResolvedValueOnce([[]]);
    const station = await getPigeonStationById(999);
    expect(station).toBeNull();
  });
});

const VALID_INPUT = {
  name: "三重站",
  phone: "02-29724082",
  address: "三重區河邊北街166號",
  lat: 25.06379,
  lng: 121.49301,
  sourceUrl: "https://nicepigeon.com/news_detail.php?id=16",
};

describe("createPigeonStation", () => {
  it("rejects an empty name without querying the database", async () => {
    const result = await createPigeonStation({ ...VALID_INPUT, name: "   " });
    expect(result).toEqual({ ok: false, error: "請輸入取鴿站名稱" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range latitude", async () => {
    const result = await createPigeonStation({ ...VALID_INPUT, lat: 91 });
    expect(result).toEqual({ ok: false, error: "緯度必須介於 -90 到 90 之間" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("allows a null lat/lng (unresolved geocode)", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 5 }]);
    const result = await createPigeonStation({ ...VALID_INPUT, lat: null, lng: null });
    expect(result).toEqual({ ok: true, id: 5 });
    expect(queryMock.mock.calls[0][1]).toEqual([
      "三重站",
      "02-29724082",
      "三重區河邊北街166號",
      null,
      null,
      "https://nicepigeon.com/news_detail.php?id=16",
    ]);
  });

  it("trims fields and inserts a new row", async () => {
    queryMock.mockResolvedValueOnce([{ insertId: 7 }]);
    const result = await createPigeonStation({ ...VALID_INPUT, name: "  三重站  " });
    expect(result).toEqual({ ok: true, id: 7 });
    expect(queryMock.mock.calls[0][0]).toContain("INSERT INTO pigeon_stations");
    expect(queryMock.mock.calls[0][1][0]).toBe("三重站");
  });
});

describe("updatePigeonStation", () => {
  it("returns ok:false when no row was affected", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await updatePigeonStation(999, VALID_INPUT);
    expect(result).toEqual({ ok: false, error: "找不到這個取鴿站" });
  });

  it("updates an existing row", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await updatePigeonStation(1, VALID_INPUT);
    expect(result).toEqual({ ok: true });
    expect(queryMock.mock.calls[0][0]).toContain("UPDATE pigeon_stations");
  });
});

describe("deletePigeonStation", () => {
  it("returns ok:false when no row was affected", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 0 }]);
    const result = await deletePigeonStation(999);
    expect(result).toEqual({ ok: false, error: "找不到這個取鴿站" });
  });

  it("deletes an existing row", async () => {
    queryMock.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const result = await deletePigeonStation(1);
    expect(result).toEqual({ ok: true });
  });
});
