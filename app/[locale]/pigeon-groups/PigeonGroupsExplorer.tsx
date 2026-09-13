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
import type { PigeonGroupMapPoint } from "./PigeonGroupsMap";

// Leaflet touches `window`/DOM APIs at module scope, so it can't render on
// the server — ssr:false is only permitted from a Client Component (this
// file), not from the async Server Component page that renders it.
const PigeonGroupsMap = dynamic(() => import("./PigeonGroupsMap"), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-xl border border-border bg-surface-subtle sm:h-[480px]" />,
});

export interface PigeonGroupListItem {
  id: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  chairmanName: string | null;
  chairmanPhone: string | null;
  secretaryName: string | null;
  secretaryPhone: string | null;
  websiteUrl: string | null;
  pigeonTrackingUrl: string | null;
}

export interface PigeonGroupsExplorerProps {
  groups: PigeonGroupListItem[];
  noAddressLabel: string;
  noCoordinatesLabel: string;
}

export default function PigeonGroupsExplorer({ groups, noAddressLabel, noCoordinatesLabel }: PigeonGroupsExplorerProps) {
  const t = useTranslations("pigeonGroupsPage");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [state, dispatch] = useReducer(directoryListReducer, INITIAL_DIRECTORY_LIST_STATE);

  // Issue #275: one automatic, on-mount geolocation request shared by both
  // the map's initial center and the list's distance sort — replacing the
  // previous separate, manually-clicked "使用目前位置" state (issue #260).
  // `relocate` backs the "重新定位" button below, an explicit refresh of that
  // same one result.
  const { geolocation, isLocating, relocate } = useMapGeolocation();

  // County options only ever list counties that actually occur in `groups`
  // — computed from the full, unfiltered list so switching the search text
  // never makes county options disappear out from under the dropdown.
  // Mirrors PigeonShopsExplorer.tsx / issue #256.
  const counties = useMemo(() => listPresentCounties(groups), [groups]);

  const filteredGroups = useMemo(
    () => filterPigeonDirectoryEntries(groups, { searchQuery: state.searchQuery, county: state.county }),
    [groups, state.searchQuery, state.county],
  );

  // Re-sorts the (already search/county-filtered) list nearest-first via the
  // shared pure helper (lib/pigeonDirectoryDistance.ts), annotating each row
  // with its distance, whenever geolocation has resolved to a genuine
  // position. Falls back to `groups`' existing name order otherwise
  // (pending, denied, unsupported, or the Chiayi fallback) — entries with no
  // coordinates sort last with distanceKm: null either way rather than being
  // hidden.
  const sortOrigin = useMemo(() => selectDistanceSortOrigin(geolocation), [geolocation]);
  const sortedGroups = useMemo(
    () =>
      sortOrigin
        ? sortByDistanceFromOrigin(filteredGroups, sortOrigin)
        : filteredGroups.map((group) => ({ ...group, distanceKm: null as number | null })),
    [filteredGroups, sortOrigin],
  );

  const { page, totalPages, items: displayedGroups } = useMemo(
    () => paginateClientList(sortedGroups, state.page, state.pageSize),
    [sortedGroups, state.page, state.pageSize],
  );

  const mapPoints = useMemo<PigeonGroupMapPoint[]>(
    () =>
      sortedGroups
        .filter((group): group is typeof group & { lat: number; lng: number } => group.lat !== null && group.lng !== null)
        .map((group) => ({
          id: group.id,
          name: group.name,
          address: group.address,
          chairmanName: group.chairmanName,
          lat: group.lat,
          lng: group.lng,
        })),
    [sortedGroups],
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
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-interactive-primary px-4 py-2 text-sm font-medium text-interactive-primary hover:bg-interactive-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLocating ? t("locatingLabel") : t("relocateButton")}
        </button>
      </div>

      <PigeonGroupsMap groups={mapPoints} selectedId={selectedId} geolocation={geolocation} userLocation={sortOrigin} />

      {sortedGroups.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-white p-6 text-sm text-ink-light">{t("noResults")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-white">
          {displayedGroups.map((group) => {
            const hasCoordinates = group.lat !== null && group.lng !== null;
            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => hasCoordinates && setSelectedId(group.id)}
                  disabled={!hasCoordinates}
                  aria-current={selectedId === group.id}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left transition enabled:hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-70 aria-[current=true]:bg-surface-subtle"
                >
                  <span className="text-sm font-bold text-ink">{group.name}</span>
                  <span className="text-sm text-ink-light">{group.address ?? noAddressLabel}</span>
                  {group.distanceKm !== null && (
                    <span className="text-xs font-medium text-interactive-primary">
                      {t("distanceLabel", { distance: group.distanceKm.toFixed(1) })}
                    </span>
                  )}
                  {group.chairmanName && (
                    <span className="text-sm text-ink-light">
                      {t("chairmanPrefix")}
                      {group.chairmanName}
                      {group.chairmanPhone ? `（${group.chairmanPhone}）` : ""}
                    </span>
                  )}
                  {group.secretaryName && (
                    <span className="text-sm text-ink-light">
                      {t("secretaryPrefix")}
                      {group.secretaryName}
                      {group.secretaryPhone ? `（${group.secretaryPhone}）` : ""}
                    </span>
                  )}
                  {(group.websiteUrl || group.pigeonTrackingUrl) && (
                    <span className="flex flex-wrap gap-3 text-xs">
                      {group.websiteUrl && (
                        <a
                          href={group.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="text-interactive-primary hover:underline"
                        >
                          {t("websiteLinkLabel")}
                        </a>
                      )}
                      {group.pigeonTrackingUrl && (
                        <a
                          href={group.pigeonTrackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="text-interactive-primary hover:underline"
                        >
                          {t("trackingLinkLabel")}
                        </a>
                      )}
                    </span>
                  )}
                  {!hasCoordinates && <span className="text-xs text-ink-light">{noCoordinatesLabel}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {sortedGroups.length > 0 && (
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
            pageInfo: t("pageInfo", { page, totalPages, total: sortedGroups.length }),
          }}
        />
      )}
    </div>
  );
}
