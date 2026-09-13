"use client";

import { useMemo, useReducer, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ALL_COUNTIES_VALUE, filterPigeonDirectoryEntries, listPresentCounties } from "@/lib/pigeonDirectoryFilters";
import { selectDistanceSortOrigin, sortByDistanceFromOrigin } from "@/lib/pigeonDirectoryDistance";
import { useMapGeolocation } from "@/lib/useMapGeolocation";
import { paginateClientList } from "@/lib/clientPagination";
import {
  INITIAL_DIRECTORY_LIST_STATE,
  PIGEON_DIRECTORY_PAGE_SIZES,
  directoryListReducer,
  isPigeonDirectoryPageSize,
} from "@/lib/pigeonDirectoryListState";
import ClientPaginationFooter from "../components/ClientPaginationFooter";
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
  const [state, dispatch] = useReducer(directoryListReducer, INITIAL_DIRECTORY_LIST_STATE);

  // Issue #275: one automatic, on-mount geolocation request shared by both
  // the map's initial center and the list's distance sort — replacing the
  // previous separate, manually-clicked "使用目前位置" state. `relocate` backs
  // the "重新定位" button below, an explicit refresh of that same one result.
  const { geolocation, isLocating, relocate } = useMapGeolocation();

  // Issue #256: county options only ever list counties that actually occur
  // in `shops` — computed from the full, unfiltered list so switching the
  // search text never makes county options disappear out from under the
  // dropdown.
  const counties = useMemo(() => listPresentCounties(shops), [shops]);

  const filteredShops = useMemo(
    () => filterPigeonDirectoryEntries(shops, { searchQuery: state.searchQuery, county: state.county }),
    [shops, state.searchQuery, state.county],
  );

  // Distance sorting is layered on top of the search/county filter — it
  // never changes which shops are shown, only the order (and, for entries
  // with coordinates, a distanceKm to display). Falls back to `shops`'
  // existing name order whenever there's no real position yet (pending,
  // denied, unsupported, or the Chiayi fallback) — the "現有 fallback 邏輯"
  // issue #275 says not to change.
  const sortOrigin = useMemo(() => selectDistanceSortOrigin(geolocation), [geolocation]);
  const sortedShops = useMemo(
    () =>
      sortOrigin
        ? sortByDistanceFromOrigin(filteredShops, sortOrigin)
        : filteredShops.map((shop) => ({ ...shop, distanceKm: null as number | null })),
    [filteredShops, sortOrigin],
  );

  const { page, totalPages, items: displayedShops } = useMemo(
    () => paginateClientList(sortedShops, state.page, state.pageSize),
    [sortedShops, state.page, state.pageSize],
  );

  const mapPoints = useMemo<PigeonShopMapPoint[]>(
    () =>
      filteredShops
        .filter((shop): shop is PigeonShopListItem & { lat: number; lng: number } => shop.lat !== null && shop.lng !== null)
        .map((shop) => ({ id: shop.id, name: shop.name, phone: shop.phone, address: shop.address, lat: shop.lat, lng: shop.lng })),
    [filteredShops],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={state.searchQuery}
          onChange={(event) => dispatch({ type: "search", value: event.target.value })}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          className="w-full rounded-xl border border-border bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-light focus:border-interactive-primary focus:outline-none sm:max-w-xs"
        />
        <select
          value={state.county}
          onChange={(event) => dispatch({ type: "county", value: event.target.value })}
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
          onClick={relocate}
          disabled={isLocating}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:shrink-0"
        >
          {isLocating ? t("locatingLabel") : t("relocateButton")}
        </button>
      </div>

      <PigeonShopsMap shops={mapPoints} selectedId={selectedId} geolocation={geolocation} userLocation={sortOrigin} />

      {filteredShops.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-white p-6 text-sm text-ink-light">{t("noResults")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-white">
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

      {filteredShops.length > 0 && (
        <ClientPaginationFooter
          pageSizes={PIGEON_DIRECTORY_PAGE_SIZES}
          pageSize={state.pageSize}
          page={page}
          totalPages={totalPages}
          onPageSizeChange={(size) => isPigeonDirectoryPageSize(size) && dispatch({ type: "pageSize", value: size })}
          onPageChange={(target) => dispatch({ type: "page", value: target })}
          labels={{
            pageSizeLabel: t("pageSizeLabel"),
            prevPage: t("prevPage"),
            nextPage: t("nextPage"),
            pageInfo: t("pageInfo", { page, totalPages, total: filteredShops.length }),
          }}
        />
      )}
    </div>
  );
}
