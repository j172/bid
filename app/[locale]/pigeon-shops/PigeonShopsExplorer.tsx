"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ALL_COUNTIES_VALUE, filterPigeonDirectoryEntries, listPresentCounties } from "@/lib/pigeonDirectoryFilters";
import { sortByDistanceFromOrigin } from "@/lib/pigeonDirectoryDistance";
import type { PigeonShopMapPoint } from "./PigeonShopsMap";

// Leaflet touches `window`/DOM APIs at module scope, so it can't render on
// the server — ssr:false is only permitted from a Client Component (this
// file), not from the async Server Component page that renders it.
const PigeonShopsMap = dynamic(() => import("./PigeonShopsMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-xl border border-border bg-surface-subtle sm:h-[480px]" />,
});

export interface PigeonShopListItem {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

export interface PigeonShopsExplorerProps {
  shops: PigeonShopListItem[];
  noCoordinatesLabel: string;
  noPhoneLabel: string;
  noAddressLabel: string;
}

export default function PigeonShopsExplorer({
  shops,
  noCoordinatesLabel,
  noPhoneLabel,
  noAddressLabel,
}: PigeonShopsExplorerProps) {
  const t = useTranslations("pigeonShopsPage");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [county, setCounty] = useState<string>(ALL_COUNTIES_VALUE);

  // Issue #259: "使用目前位置" — an explicit, user-clicked one-shot
  // geolocation request (never automatic, never repeated), distinct from
  // lib/useMapGeolocation.ts's auto-on-mount center/zoom pick (issue #256).
  // Denied/unsupported/failed states are surfaced as plain text below the
  // button, never thrown — see handleUseMyLocation.
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Issue #256: county options only ever list counties that actually occur
  // in `shops` — computed from the full, unfiltered list so switching the
  // search text never makes county options disappear out from under the
  // dropdown.
  const counties = useMemo(() => listPresentCounties(shops), [shops]);

  const filteredShops = useMemo(
    () => filterPigeonDirectoryEntries(shops, { searchQuery, county }),
    [shops, searchQuery, county],
  );

  // Distance sorting is layered on top of the search/county filter — it
  // never changes which shops are shown, only the order (and, for entries
  // with coordinates, a distanceKm to display) once the user has opted in.
  const displayedShops = useMemo(
    () =>
      userLocation
        ? sortByDistanceFromOrigin(filteredShops, userLocation)
        : filteredShops.map((shop) => ({ ...shop, distanceKm: null as number | null })),
    [filteredShops, userLocation],
  );

  const mapPoints = useMemo<PigeonShopMapPoint[]>(
    () =>
      filteredShops
        .filter((shop): shop is PigeonShopListItem & { lat: number; lng: number } => shop.lat !== null && shop.lng !== null)
        .map((shop) => ({ id: shop.id, name: shop.name, phone: shop.phone, address: shop.address, lat: shop.lat, lng: shop.lng })),
    [filteredShops],
  );

  function handleUseMyLocation() {
    setLocationError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError(t("geolocationUnsupported"));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      () => {
        // Denied, timed out, or position unavailable — none of Geolocation's
        // error union is actionable here beyond telling the user, per issue
        // #259's "顯示清楚的錯誤提示文字，不可讓頁面壞掉或整頁報錯" requirement.
        setUserLocation(null);
        setLocating(false);
        setLocationError(t("geolocationDenied"));
      },
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          className="w-full rounded-xl border border-border bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-light focus:border-interactive-primary focus:outline-none sm:max-w-xs"
        />
        <select
          value={county}
          onChange={(event) => setCounty(event.target.value)}
          aria-label={t("countyFilterLabel")}
          className="w-full rounded-xl border border-border bg-white px-4 py-2 text-sm text-ink focus:border-interactive-primary focus:outline-none sm:w-48"
        >
          <option value={ALL_COUNTIES_VALUE}>{t("countyFilterAll")}</option>
          {counties.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:shrink-0"
        >
          {locating ? t("locatingLabel") : t("useMyLocationButton")}
        </button>
      </div>

      {locationError && <p className="mb-4 text-sm text-ended">{locationError}</p>}

      <PigeonShopsMap shops={mapPoints} selectedId={selectedId} userLocation={userLocation} />

      {filteredShops.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-white p-6 text-sm text-ink-light">{t("noResults")}</p>
      ) : (
        <ul className="mt-6 max-h-[600px] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-white">
          {displayedShops.map((shop) => {
            const hasCoordinates = shop.lat !== null && shop.lng !== null;
            return (
              <li key={shop.id}>
                <button
                  type="button"
                  onClick={() => hasCoordinates && setSelectedId(shop.id)}
                  disabled={!hasCoordinates}
                  aria-current={selectedId === shop.id}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition enabled:hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-70 aria-[current=true]:bg-surface-subtle"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-ink">{shop.name}</span>
                    {shop.distanceKm !== null && (
                      <span className="shrink-0 text-xs font-medium text-interactive-primary">
                        {t("distanceLabel", { km: shop.distanceKm.toFixed(1) })}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-ink-light">{shop.phone ?? noPhoneLabel}</span>
                  <span className="text-sm text-ink-light">{shop.address ?? noAddressLabel}</span>
                  {!hasCoordinates && <span className="text-xs text-ink-light">{noCoordinatesLabel}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
