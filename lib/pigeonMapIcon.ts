import L from "leaflet";

/**
 * Shared Leaflet marker icon configuration for directory maps (pigeon-stations,
 * pigeon-shops, and pigeon-groups; issue #321).
 *
 * Uses same-origin static assets located in public/images/leaflet/ rather than
 * an external CDN (unpkg) or webpack/Turbopack ES module image imports (which
 * evaluated to undefined at runtime and caused the /pigeon-stations crash).
 */
export const PIGEON_MAP_ICON_OPTIONS: L.IconOptions = {
  iconUrl: "/images/leaflet/marker-icon.png",
  iconRetinaUrl: "/images/leaflet/marker-icon-2x.png",
  shadowUrl: "/images/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
};

let cachedIcon: L.Icon | null = null;

export function getPigeonMapIcon(): L.Icon {
  if (!cachedIcon) {
    cachedIcon = L.icon(PIGEON_MAP_ICON_OPTIONS);
  }
  return cachedIcon;
}
