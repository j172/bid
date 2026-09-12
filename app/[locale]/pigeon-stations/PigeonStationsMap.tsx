"use client";

// The actual Leaflet map. Only ever mounted client-side — see
// PigeonStationsMapLoader.tsx, which loads this via next/dynamic with
// ssr:false, because Leaflet touches `window`/`document` at import time and
// cannot run during Next.js's server render pass.
//
// Kept as a single imperative useEffect (plain Leaflet, not react-leaflet)
// rather than a declarative component tree: this project has no other map
// on it yet, and one small `L.map(...)` setup is simpler than adding a new
// UI-library dependency for a single page.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslations } from "next-intl";
import { useMapGeolocation } from "@/lib/useMapGeolocation";
// Leaflet's default marker icon references image URLs that assume being
// served from leaflet's own dist/ directory — broken once bundled by
// webpack/Turbopack. Re-pointing at the bundled copies of the same PNGs
// (imported so Next.js's static-asset pipeline fingerprints/serves them) is
// the standard fix; see https://github.com/Leaflet/Leaflet/issues/4968.
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

let defaultIconConfigured = false;
function configureDefaultIcon() {
  if (defaultIconConfigured) return;
  defaultIconConfigured = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet's own documented workaround deletes an internal method
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x.src,
    iconUrl: markerIcon.src,
    shadowUrl: markerShadow.src,
  });
}

export interface PigeonStationMapPoint {
  id: number;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
}

const FOCUS_ZOOM = 15;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function PigeonStationsMap({
  stations,
  selectedId,
}: {
  stations: PigeonStationMapPoint[];
  /** Station id to fly the map to and open its popup for — set by clicking a list item. */
  selectedId: number | null;
}) {
  const t = useTranslations("pigeonStations");
  // Issue #256: the initial center/zoom comes from the browser's geolocation
  // (city-level zoom on the user, falling back to Chiayi City Government) —
  // see lib/useMapGeolocation.ts. Null while that request is still pending;
  // the map isn't mounted until it resolves (below). This replaces the
  // previous behavior of fitBounds()-ing to every station on mount, which
  // would otherwise immediately zoom back out past whatever geolocation set.
  const geolocation = useMapGeolocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  // Mount/unmount the map exactly once, as soon as geolocation resolves.
  useEffect(() => {
    if (!geolocation || !containerRef.current || mapRef.current) return;
    configureDefaultIcon();

    const map = L.map(containerRef.current).setView(geolocation.center, geolocation.zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [geolocation]);

  // Keep markers in sync with the (already-filtered, per issue #256's search
  // + county filter) stations list — a station hidden by the filter simply
  // isn't in `stations`, so it's removed here like any other
  // no-longer-present id. Also re-runs once `geolocation` resolves and the
  // map above actually mounts, in case `stations` itself hasn't changed
  // since the initial render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const nextIds = new Set(stations.map((station) => station.id));

    for (const [id, marker] of markers) {
      if (!nextIds.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    for (const station of stations) {
      if (markers.has(station.id)) continue;
      const marker = L.marker([station.lat, station.lng])
        .addTo(map)
        .bindPopup(
          `<strong>${escapeHtml(station.name)}</strong><br/>${escapeHtml(station.phone)}<br/>${escapeHtml(station.address)}`,
        );
      markers.set(station.id, marker);
    }
  }, [stations, geolocation]);

  // Fly to + open the popup of whichever station was just clicked in the list.
  useEffect(() => {
    if (selectedId === null) return;
    const map = mapRef.current;
    const marker = markersRef.current.get(selectedId);
    if (!map || !marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.75 });
    marker.openPopup();
  }, [selectedId]);

  // While geolocation is still pending, don't mount the container div at all
  // — the mount effect above only creates the Leaflet map once `geolocation`
  // is non-null.
  if (!geolocation) {
    return (
      <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-border bg-surface-muted text-sm text-ink-light sm:h-[480px]">
        {t("mapLoading")}
      </div>
    );
  }

  return <div ref={containerRef} className="h-[420px] w-full rounded-2xl border border-border sm:h-[480px]" />;
}
