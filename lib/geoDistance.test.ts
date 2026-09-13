import { describe, expect, it } from "vitest";
import { haversineDistanceKm, sortByDistanceFrom } from "./geoDistance";

interface Entry {
  id: number;
  lat: number | null;
  lng: number | null;
}

describe("haversineDistanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceKm({ lat: 25.0478, lng: 121.5319 }, { lat: 25.0478, lng: 121.5319 })).toBe(0);
  });

  it("matches the known great-circle distance between Taipei and Kaohsiung (~300km)", () => {
    // Taipei Main Station -> Kaohsiung Main Station, straight-line distance
    // is well documented as roughly 300km.
    const taipei = { lat: 25.0478, lng: 121.5319 };
    const kaohsiung = { lat: 22.6373, lng: 120.3019 };
    const distance = haversineDistanceKm(taipei, kaohsiung);
    expect(distance).toBeGreaterThan(280);
    expect(distance).toBeLessThan(320);
  });

  it("is symmetric", () => {
    const a = { lat: 24.1477, lng: 120.6736 };
    const b = { lat: 23.4810744, lng: 120.4535581 };
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10);
  });
});

describe("sortByDistanceFrom", () => {
  const origin = { lat: 25.0478, lng: 121.5319 }; // Taipei

  it("sorts entries nearest-first", () => {
    const entries: Entry[] = [
      { id: 1, lat: 22.6373, lng: 120.3019 }, // Kaohsiung — far
      { id: 2, lat: 25.0478, lng: 121.5319 }, // Taipei — same point, distance 0
      { id: 3, lat: 24.1477, lng: 120.6736 }, // Taichung — middle
    ];

    const sorted = sortByDistanceFrom(entries, origin);
    expect(sorted.map((e) => e.id)).toEqual([2, 3, 1]);
    expect(sorted[0].distanceKm).toBe(0);
    expect(sorted[1].distanceKm).toBeGreaterThan(0);
    expect(sorted[2].distanceKm).toBeGreaterThan(sorted[1].distanceKm as number);
  });

  it("sorts entries with no coordinates last, preserving their relative order", () => {
    const entries: Entry[] = [
      { id: 1, lat: null, lng: null },
      { id: 2, lat: 25.0478, lng: 121.5319 },
      { id: 3, lat: null, lng: null },
    ];

    const sorted = sortByDistanceFrom(entries, origin);
    expect(sorted.map((e) => e.id)).toEqual([2, 1, 3]);
    expect(sorted[1].distanceKm).toBeNull();
    expect(sorted[2].distanceKm).toBeNull();
  });

  it("returns an empty array for an empty list", () => {
    expect(sortByDistanceFrom([], origin)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const entries: Entry[] = [
      { id: 1, lat: 22.6373, lng: 120.3019 },
      { id: 2, lat: 25.0478, lng: 121.5319 },
    ];
    const copy = [...entries];
    sortByDistanceFrom(entries, origin);
    expect(entries).toEqual(copy);
  });
});
