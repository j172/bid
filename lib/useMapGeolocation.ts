"use client";

// Shared geolocation-on-mount logic for the pigeon-shops and pigeon-stations
// Leaflet maps (issue #256) — previously each map would have needed its own
// copy of this request/fallback dance.
//
// On mount, asks the browser for the user's current position. Success:
// center on the user at city-level zoom. Denied, failed, or the browser has
// no Geolocation API at all: fall back to Chiayi City Government's
// coordinates at the same zoom, so both pages still open on a sensible,
// consistent default rather than an error state or a country-wide view.
//
// Returns null while the request is still pending — callers render a
// loading placeholder in place of the map for that (typically brief) window
// rather than mounting Leaflet with a center that would immediately jump.

import { useEffect, useState } from "react";

/** Chiayi City Government (嘉義市政府) — the fallback center when geolocation
 * is denied, fails, or isn't supported by the browser. Not `readonly` — this
 * is handed straight to Leaflet's `setView()`, which wants a mutable
 * [lat, lng] tuple. */
export const GEOLOCATION_FALLBACK_CENTER: [number, number] = [23.4810744, 120.4535581];

/** City-level zoom, used for both the successful-geolocation and the
 * fallback center. */
export const GEOLOCATION_ZOOM = 13;

export interface MapGeolocationResult {
  center: [number, number];
  zoom: number;
  /** True when `center` is the user's real position; false when it's the
   * Chiayi fallback (denied/failed/unsupported). */
  isUserLocation: boolean;
}

export function useMapGeolocation(): MapGeolocationResult | null {
  const [result, setResult] = useState<MapGeolocationResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setResult({ center: GEOLOCATION_FALLBACK_CENTER, zoom: GEOLOCATION_ZOOM, isUserLocation: false });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setResult({
          center: [position.coords.latitude, position.coords.longitude],
          zoom: GEOLOCATION_ZOOM,
          isUserLocation: true,
        });
      },
      () => {
        // Denied, timed out, or position unavailable — Geolocation's own
        // error union, none of which are actionable here beyond falling back.
        if (cancelled) return;
        setResult({ center: GEOLOCATION_FALLBACK_CENTER, zoom: GEOLOCATION_ZOOM, isUserLocation: false });
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
