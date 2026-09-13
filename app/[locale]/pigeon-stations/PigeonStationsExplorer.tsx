"use client";

// Client half of /pigeon-stations: owns which station is "selected" (so a
// list-item click can tell the (also client-only, see
// PigeonStationsMapLoader.tsx) Leaflet map to fly to + open that marker's
// popup) plus the search + county filter state (issue #256), shared with
// /pigeon-shops and /pigeon-groups via lib/pigeonDirectoryFilters.ts —
// extended by issue #275 with the same automatic distance sort + pagination
// as those two pages. The server component (page.tsx) only fetches data and
// renders static text around this.

import { useMemo, useReducer, useState } from "react";
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
import PigeonStationsMap from "./PigeonStationsMapLoader";

export interface PigeonStationListItem {
  id: number;
  name: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export default function PigeonStationsExplorer({ stations }: { stations: PigeonStationListItem[] }) {
  const t = useTranslations("pigeonStations");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [state, dispatch] = useReducer(directoryListReducer, INITIAL_DIRECTORY_LIST_STATE);

  // Issue #275: one automatic, on-mount geolocation request shared by both
  // the map's initial center and the list's distance sort. `relocate` backs
  // the "重新定位" button below, an explicit refresh of that same one result.
  const { geolocation, isLocating, relocate } = useMapGeolocation();

  // Issue #256: county options only ever list counties that actually occur
  // in `stations` — computed from the full, unfiltered list so switching the
  // search text never makes county options disappear out from under the
  // dropdown.
  const counties = useMemo(() => listPresentCounties(stations), [stations]);

  const filteredStations = useMemo(
    () => filterPigeonDirectoryEntries(stations, { searchQuery: state.searchQuery, county: state.county }),
    [stations, state.searchQuery, state.county],
  );

  // Distance sorting is layered on top of the search/county filter — it
  // never changes which stations are shown, only the order (and, for
  // entries with coordinates, a distanceKm to display). Falls back to
  // `stations`' existing name order whenever there's no real position yet
  // (pending, denied, unsupported, or the Chiayi fallback).
  const sortOrigin = useMemo(() => selectDistanceSortOrigin(geolocation), [geolocation]);
  const sortedStations = useMemo(
    () =>
      sortOrigin
        ? sortByDistanceFromOrigin(filteredStations, sortOrigin)
        : filteredStations.map((station) => ({ ...station, distanceKm: null as number | null })),
    [filteredStations, sortOrigin],
  );

  const { page, totalPages, items: displayedStations } = useMemo(
    () => paginateClientList(sortedStations, state.page, state.pageSize),
    [sortedStations, state.page, state.pageSize],
  );

  // Only stations with a successful geocode (see scripts/import-pigeon-
  // stations.mjs's header comment on why lat/lng can be NULL) get a marker;
  // the list still shows every filtered station regardless of pagination.
  const mappable = useMemo(
    () =>
      filteredStations.filter(
        (station): station is PigeonStationListItem & { lat: number; lng: number } =>
          station.lat !== null && station.lng !== null,
      ),
    [filteredStations],
  );
  const hasUnmapped = mappable.length < filteredStations.length;

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row">
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

      <div className="mt-4">
        <PigeonStationsMap stations={mappable} selectedId={selectedId} geolocation={geolocation} userLocation={sortOrigin} />
      </div>
      {hasUnmapped && <p className="mt-2 text-xs text-ink-light">{t("unmappedNote")}</p>}

      <h2 className="mt-8 text-lg font-bold text-ink">{t("listTitle")}</h2>

      {filteredStations.length === 0 ? (
        <p className="mt-3 text-sm text-ink-light">{stations.length === 0 ? t("noItems") : t("noResults")}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayedStations.map((station) => {
            const isMappable = station.lat !== null && station.lng !== null;
            return (
              <li
                key={station.id}
                className={`rounded-xl border p-4 transition ${
                  selectedId === station.id
                    ? "border-interactive-primary bg-interactive-primary/5"
                    : "border-border bg-white"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <p className="font-semibold text-ink">{station.name}</p>
                  {station.distanceKm !== null && (
                    <span className="shrink-0 text-xs font-medium text-interactive-primary">
                      {t("distanceLabel", { km: station.distanceKm.toFixed(1) })}
                    </span>
                  )}
                </span>
                <a
                  href={`tel:${station.phone.replace(/[^0-9+]/g, "")}`}
                  className="mt-1 block text-sm text-ink-light hover:text-interactive-primary hover:underline"
                >
                  {t("callLabel", { phone: station.phone })}
                </a>
                <p className="mt-1 text-sm text-ink-light">{station.address}</p>
                {isMappable && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(station.id)}
                    className="mt-2 text-xs font-medium text-interactive-primary hover:underline"
                  >
                    {t("viewOnMap")} →
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {filteredStations.length > 0 && (
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
            pageInfo: t("pageInfo", { page, totalPages, total: filteredStations.length }),
          }}
        />
      )}
    </div>
  );
}
