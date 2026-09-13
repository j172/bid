"use client";

// Shared geolocation-on-mount logic for the pigeon-shops, pigeon-stations,
// and pigeon-groups Leaflet maps and directory list sorting (issue #256,
// extended by issue #275).
//
// On mount, asks the browser for the user's current position. Success:
// center on the user at city-level zoom. Denied, failed, or the browser has
// no Geolocation API at all: fall back to Chiayi City Government's
// coordinates at the same zoom, so both pages still open on a sensible,
// consistent default rather than an error state or a country-wide view.
//
// `geolocation` is null while the request is still pending — callers render
// a loading placeholder in place of the map for that (typically brief)
// window rather than mounting Leaflet with a center that would immediately
// jump. It never goes back to null after that first resolution (including
// across `relocate()` calls) so a manual re-locate never tears down an
// already-mounted map.
//
// Issue #275: the same resolved location now also drives the directory list's
// automatic distance sort (see lib/pigeonDirectoryDistance.ts's
// selectDistanceSortOrigin) — one browser geolocation request per page load
// serves both the map's initial center and the list's sort order, and the
// explorer's "重新定位" (re-locate) button re-requests it via `relocate()`,
// refreshing both at once rather than each owning a separate request.

import { useCallback, useEffect, useRef, useState } from "react";

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

export interface UseMapGeolocationResult {
  /** Null only until the first request (mount or a `relocate()`) resolves. */
  geolocation: MapGeolocationResult | null;
  /** True while a geolocation request (initial or from `relocate()`) is in flight. */
  isLocating: boolean;
  /** Re-requests the browser's current position on demand (issue #275's
   * "重新定位" button). Never resets `geolocation` back to null — the map
   * keeps showing the previous result (and the list its previous sort)
   * until the new one resolves, so a manual re-locate never unmounts the
   * already-rendered map. */
  relocate: () => void;
}

function fallbackResult(): MapGeolocationResult {
  return { center: GEOLOCATION_FALLBACK_CENTER, zoom: GEOLOCATION_ZOOM, isUserLocation: false };
}

export function useMapGeolocation(): UseMapGeolocationResult {
  const [geolocation, setGeolocation] = useState<MapGeolocationResult | null>(null);
  const [isLocating, setIsLocating] = useState(true);
  // Guards against setting state from a geolocation callback that resolves
  // after the component using this hook has unmounted.
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const relocate = useCallback(() => {
    setIsLocating(true);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeolocation(fallbackResult());
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mountedRef.current) return;
        setGeolocation({
          center: [position.coords.latitude, position.coords.longitude],
          zoom: GEOLOCATION_ZOOM,
          isUserLocation: true,
        });
        setIsLocating(false);
      },
      () => {
        // Denied, timed out, or position unavailable — Geolocation's own
        // error union, none of which are actionable here beyond falling back.
        if (!mountedRef.current) return;
        setGeolocation(fallbackResult());
        setIsLocating(false);
      },
    );
  }, []);

  // Request once on mount. `relocate` is stable (empty deps above), so this
  // never re-runs on its own — only an explicit relocate() call from a
  // caller (e.g. the "重新定位" button) requests again.
  useEffect(() => {
    relocate();
  }, [relocate]);

  return { geolocation, isLocating, relocate };
}
