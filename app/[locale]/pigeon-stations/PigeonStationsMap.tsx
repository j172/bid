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

// Rough center of Taiwan — shown only until fitBounds() below runs (or as a
// fallback if there are zero geocoded stations to bound to).
const TAIWAN_CENTER: [number, number] = [23.6, 121];
const DEFAULT_ZOOM = 7;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  // Mount/rebuild the map whenever the station set changes. Stations come
  // from a server-rendered list that doesn't change after mount in normal
  // use, but rebuilding on change keeps this correct if that ever stops
  // being true (e.g. a future client-side filter).
  useEffect(() => {
    if (!containerRef.current) return;
    configureDefaultIcon();

    const map = L.map(containerRef.current).setView(TAIWAN_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const markers = new Map<number, L.Marker>();
    const bounds: [number, number][] = [];
    for (const station of stations) {
      const marker = L.marker([station.lat, station.lng])
        .addTo(map)
        .bindPopup(
          `<strong>${escapeHtml(station.name)}</strong><br/>${escapeHtml(station.phone)}<br/>${escapeHtml(station.address)}`,
        );
      markers.set(station.id, marker);
      bounds.push([station.lat, station.lng]);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
    }

    mapRef.current = map;
    markersRef.current = markers;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = new Map();
    };
  }, [stations]);

  // Fly to + open the popup of whichever station was just clicked in the list.
  useEffect(() => {
    if (selectedId === null) return;
    const map = mapRef.current;
    const marker = markersRef.current.get(selectedId);
    if (!map || !marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.75 });
    marker.openPopup();
  }, [selectedId]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-2xl border border-border sm:h-[480px]" />;
}
