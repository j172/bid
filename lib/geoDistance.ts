// Pure Haversine distance + list-sorting helpers for the "使用目前位置"
// (use my location) button on the pigeon-groups directory page (issue #260).
//
// Deliberately separate from lib/useMapGeolocation.ts's mount-time
// auto-center hook (issue #256) — that hook only decides where the Leaflet
// map first centers on page load; this module powers an explicit
// button-triggered re-sort of the list by distance from the user (with the
// distance itself shown per row), which #256 never added. Framework-agnostic
// pure functions so they're unit-testable without mounting React or mocking
// the browser's Geolocation API.
//
// As of this writing, issue #259 (the parallel cb-pigeon.com 店家匯入
// ticket, which independently wants the same "使用目前位置" behavior for
// /pigeon-shops) had not yet merged — per both issues' explicit "若還沒合併
// 就先各自獨立實作" instruction, this was built standalone rather than
// waiting on it. It's a plain, dependency-free module (no pigeon-groups-
// specific types), so #259 — or any future page — can import it directly
// instead of duplicating the math.

const EARTH_RADIUS_KM = 6371;

export interface Coordinates {
  lat: number;
  lng: number;
}

/** Great-circle distance between two points, in kilometers. */
export function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

export interface WithOptionalCoordinates {
  lat: number | null;
  lng: number | null;
}

export interface WithDistance {
  /** Distance from the sort origin in kilometers, or null when the entry has
   * no coordinates to measure from (see pigeon_groups/pigeon_shops' nullable
   * lat/lng columns — an address that failed to geocode). */
  distanceKm: number | null;
}

/**
 * Sorts `entries` by distance from `origin`, nearest first. Entries without
 * coordinates sort last, in their original relative order, each annotated
 * with `distanceKm: null` rather than being dropped — they still belong in
 * the list, just without a distance to show or a map marker to fly to.
 * Array.prototype.sort is spec-guaranteed stable, so ties (including the
 * "both null" case) keep their original relative order.
 */
export function sortByDistanceFrom<T extends WithOptionalCoordinates>(
  entries: readonly T[],
  origin: Coordinates,
): (T & WithDistance)[] {
  const withDistance = entries.map((entry) => ({
    ...entry,
    distanceKm:
      entry.lat !== null && entry.lng !== null
        ? haversineDistanceKm(origin, { lat: entry.lat, lng: entry.lng })
        : null,
  }));

  return withDistance.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return 0;
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}
