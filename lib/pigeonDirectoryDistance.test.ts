import { describe, expect, it } from "vitest";
import { haversineDistanceKm, sortByDistanceFromOrigin } from "./pigeonDirectoryDistance";

interface Entry {
  id: number;
  name: string;
  lat: number | null;
  lng: number | null;
}

function entry(overrides: Partial<Entry> & { id: number }): Entry {
  return { name: "鴿店", lat: null, lng: null, ...overrides };
}

// Taipei 101 and Kaohsiung's 高雄85大樓 — real-world reference points with a
// well-known straight-line distance (~300km) to sanity-check the formula
// against, not just its own internal consistency.
const TAIPEI_101 = { lat: 25.033976, lng: 121.564472 };
const KAOHSIUNG_85 = { lat: 22.612055, lng: 120.301867 };

describe("haversineDistanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceKm(TAIPEI_101, TAIPEI_101)).toBeCloseTo(0, 5);
  });

  it("matches the well-known straight-line distance between Taipei and Kaohsiung (~300km)", () => {
    const km = haversineDistanceKm(TAIPEI_101, KAOHSIUNG_85);
    expect(km).toBeGreaterThan(295);
    expect(km).toBeLessThan(305);
  });

  it("is symmetric", () => {
    expect(haversineDistanceKm(TAIPEI_101, KAOHSIUNG_85)).toBeCloseTo(haversineDistanceKm(KAOHSIUNG_85, TAIPEI_101), 9);
  });
});

describe("sortByDistanceFromOrigin", () => {
  const origin = TAIPEI_101;

  const entries: Entry[] = [
    entry({ id: 1, name: "高雄店", lat: KAOHSIUNG_85.lat, lng: KAOHSIUNG_85.lng }),
    entry({ id: 2, name: "無座標店", lat: null, lng: null }),
    entry({ id: 3, name: "台北店", lat: 25.04, lng: 121.56 }),
    entry({ id: 4, name: "另一間無座標店", lat: null, lng: null }),
  ];

  it("sorts entries with coordinates nearest-first", () => {
    const result = sortByDistanceFromOrigin(entries, origin);
    const positionedIds = result.filter((e) => e.distanceKm !== null).map((e) => e.id);
    expect(positionedIds).toEqual([3, 1]);
  });

  it("moves entries with no coordinates to the end, preserving their relative order, with distanceKm null", () => {
    const result = sortByDistanceFromOrigin(entries, origin);
    expect(result.slice(-2).map((e) => e.id)).toEqual([2, 4]);
    expect(result.slice(-2).every((e) => e.distanceKm === null)).toBe(true);
  });

  it("attaches a plausible distanceKm to the nearby entry", () => {
    const result = sortByDistanceFromOrigin(entries, origin);
    const nearby = result.find((e) => e.id === 3);
    expect(nearby?.distanceKm).not.toBeNull();
    expect(nearby!.distanceKm as number).toBeLessThan(5);
  });

  it("returns an empty array for an empty list", () => {
    expect(sortByDistanceFromOrigin([], origin)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const copy = [...entries];
    sortByDistanceFromOrigin(entries, origin);
    expect(entries).toEqual(copy);
  });
});
