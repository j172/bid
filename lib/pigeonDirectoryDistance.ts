// Distance-from-the-user sorting shared by the pigeon-shops (and, in future,
// pigeon-stations) directory explorer's "使用目前位置" button (issue #259).
// Deliberately separate from lib/useMapGeolocation.ts (issue #256), which
// auto-requests the browser's position on mount purely to choose the map's
// initial center/zoom and silently falls back to a fixed point on failure —
// this module instead supports an explicitly user-clicked action whose
// result reorders the shop list by real distance and must surface failure to
// the user as visible text, never a silent fallback.

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface HasCoordinates {
  lat: number | null;
  lng: number | null;
}

export interface WithDistance {
  /** Great-circle distance from the origin, in kilometers, or null when the
   * entry has no coordinates to measure from. */
  distanceKm: number | null;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle (haversine) distance between two lat/lng points, in km. */
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Attaches a `distanceKm` to every entry and sorts the ones that have
 * coordinates nearest-first; entries with no coordinates (never shown on the
 * map either — see PigeonShopsExplorer's hasCoordinates check) keep their
 * original relative order and are moved to the end, distanceKm: null.
 */
export function sortByDistanceFromOrigin<T extends HasCoordinates>(
  entries: readonly T[],
  origin: GeoPoint,
): (T & WithDistance)[] {
  const withDistance: (T & WithDistance)[] = entries.map((entry) => ({
    ...entry,
    distanceKm:
      entry.lat !== null && entry.lng !== null ? haversineDistanceKm(origin, { lat: entry.lat, lng: entry.lng }) : null,
  }));

  const positioned = withDistance.filter((entry): entry is T & { distanceKm: number } => entry.distanceKm !== null);
  const unpositioned = withDistance.filter((entry) => entry.distanceKm === null);
  positioned.sort((a, b) => a.distanceKm - b.distanceKm);

  return [...positioned, ...unpositioned];
}
