"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapGeolocation } from "@/lib/useMapGeolocation";

// Leaflet's default marker icon references image paths relative to the
// package itself, which breaks once bundled by webpack/Turbopack (a common,
// well-documented Leaflet+bundler gap — see leaflet/leaflet#4968). Pointing
// at the same version's images on a CDN sidesteps needing an asset-loader
// rule for a handful of tiny PNGs.
const shopIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const SELECTED_ZOOM = 15;
// Issue #259: the zoom "使用目前位置" flies to — close enough to distinguish
// nearby shops without being as tight as a single selected shop's
// SELECTED_ZOOM, since the user's own position isn't a specific shop to zero
// in on.
const USER_LOCATION_ZOOM = 14;

export interface PigeonShopMapPoint {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number;
  lng: number;
}

export interface PigeonShopsMapProps {
  shops: PigeonShopMapPoint[];
  selectedId: number | null;
  /** Issue #259's "使用目前位置" result — null until the user opts in (or if
   * geolocation was denied/unsupported/failed). Distinct from the
   * auto-on-mount lib/useMapGeolocation.ts center below, which never shows
   * its own marker. */
  userLocation?: { lat: number; lng: number } | null;
}

// Plain Leaflet (not react-leaflet, per issue #243's spec) — the map
// instance and its markers live in refs and are imperatively kept in sync
// with props via useEffect, since Leaflet owns the DOM node it's mounted
// into directly.
export default function PigeonShopsMap({ shops, selectedId, userLocation = null }: PigeonShopsMapProps) {
  // Issue #256: the initial center/zoom comes from the browser's geolocation
  // (city-level zoom on the user, falling back to Chiayi City Government) —
  // see lib/useMapGeolocation.ts. Null while that request is still pending;
  // the map isn't mounted until it resolves (below), so it never has to jump
  // from one center to another.
  const geolocation = useMapGeolocation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  // Mount/unmount the map exactly once, as soon as geolocation resolves.
  useEffect(() => {
    if (!geolocation || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView(geolocation.center, geolocation.zoom);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
      userMarkerRef.current = null;
    };
  }, [geolocation]);

  // Keep markers in sync with the (already-filtered, per issue #256's search
  // + county filter) shops list — a shop hidden by the filter simply isn't
  // in `shops`, so it's removed here like any other no-longer-present id.
  // Also re-runs once `geolocation` resolves and the map above actually
  // mounts, in case `shops` itself hasn't changed since the initial render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const nextIds = new Set(shops.map((shop) => shop.id));

    for (const [id, marker] of markers) {
      if (!nextIds.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }

    for (const shop of shops) {
      if (markers.has(shop.id)) continue;
      const marker = L.marker([shop.lat, shop.lng], { icon: shopIcon }).addTo(map);
      const phoneLine = shop.phone ? `<div>${shop.phone}</div>` : "";
      const addressLine = shop.address ? `<div>${shop.address}</div>` : "";
      marker.bindPopup(`<strong>${shop.name}</strong>${phoneLine}${addressLine}`);
      markers.set(shop.id, marker);
    }
  }, [shops, geolocation]);

  // Fly to + open the popup for whichever shop the list selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedId === null) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;
    map.flyTo(marker.getLatLng(), SELECTED_ZOOM, { duration: 0.75 });
    marker.openPopup();
  }, [selectedId]);

  // Issue #259's "使用目前位置": draw a distinct marker (a plain circle, not
  // the shop pin icon, so it reads as "you" rather than another shop) at the
  // user's position and fly the map there. Removed again if userLocation
  // goes back to null (e.g. a second click that's denied).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      userMarkerRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);
    }
    map.flyTo([userLocation.lat, userLocation.lng], USER_LOCATION_ZOOM, { duration: 0.75 });
  }, [userLocation, geolocation]);

  // While geolocation is still pending, don't mount the container div at all
  // — the mount effect above only creates the Leaflet map once `geolocation`
  // is non-null, so rendering the same placeholder next/dynamic's own
  // loading state uses keeps the two loading windows visually seamless.
  if (!geolocation) {
    return <div className="h-[420px] w-full animate-pulse rounded-xl border border-border bg-surface-subtle sm:h-[480px]" />;
  }

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl border border-border sm:h-[480px]" />;
}
