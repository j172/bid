// Distance-from-the-user sorting shared by the pigeon-shops,
// pigeon-stations, and pigeon-groups directory explorers (issue #259,
// extended to all three and made automatic by issue #275).
//
// Issue #275: the sort origin now comes straight from
// lib/useMapGeolocation.ts's own automatic on-mount result — the same one
// used to center the map — rather than a separately-clicked "使用目前位置"
// action, so the list sorts nearest-first as soon as the page loads (no
// button press required). selectDistanceSortOrigin below is the pure
// translation from that hook's result to "is there a real point to sort by".

import type { MapGeolocationResult } from "@/lib/useMapGeolocation";

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
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
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

/**
 * The point that should drive automatic distance sorting, derived from
 * lib/useMapGeolocation.ts's result: the user's real position when
 * geolocation actually succeeded, or `null` (meaning "no distance sort, fall
 * back to the existing name-order list") while it's still pending, denied,
 * unsupported, or failed — i.e. whenever `center` is only the Chiayi City
 * Government fallback rather than a genuine position. Sorting against that
 * fixed fallback point would look like a real "nearest first" result to
 * users who aren't anywhere near Chiayi, so it deliberately never becomes a
 * sort origin.
 */
export function selectDistanceSortOrigin(geolocation: MapGeolocationResult | null): GeoPoint | null {
  if (!geolocation || !geolocation.isUserLocation) return null;
  const [lat, lng] = geolocation.center;
  return { lat, lng };
}
