"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ALL_COUNTIES_VALUE, filterPigeonDirectoryEntries, listPresentCounties } from "@/lib/pigeonDirectoryFilters";
import { sortByDistanceFromOrigin } from "@/lib/pigeonDirectoryDistance";
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

type LocationState = "idle" | "loading" | "granted" | "denied" | "unsupported";

export default function PigeonGroupsExplorer({ groups, noAddressLabel, noCoordinatesLabel }: PigeonGroupsExplorerProps) {
  const t = useTranslations("pigeonGroupsPage");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [county, setCounty] = useState<string>(ALL_COUNTIES_VALUE);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationState, setLocationState] = useState<LocationState>("idle");

  // County options only ever list counties that actually occur in `groups`
  // — computed from the full, unfiltered list so switching the search text
  // never makes county options disappear out from under the dropdown.
  // Mirrors PigeonShopsExplorer.tsx / issue #256.
  const counties = useMemo(() => listPresentCounties(groups), [groups]);

  const filteredGroups = useMemo(
    () => filterPigeonDirectoryEntries(groups, { searchQuery, county }),
    [groups, searchQuery, county],
  );

  // Issue #260's "使用目前位置" button: once the browser hands back a real
  // position, re-sort the (already search/county-filtered) list nearest
  // first via the shared pure helper (lib/pigeonDirectoryDistance.ts),
  // annotating each row with its distance. Entries with no coordinates sort
  // last with distanceKm: null (see that module's own tests) rather than
  // being hidden.
  const sortedGroups = useMemo(
    () =>
      userLocation
        ? sortByDistanceFromOrigin(filteredGroups, userLocation)
        : filteredGroups.map((group) => ({ ...group, distanceKm: null as number | null })),
    [filteredGroups, userLocation],
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

  const handleUseLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationState("unsupported");
      return;
    }

    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationState("granted");
      },
      () => {
        // Denied, timed out, or position unavailable — Geolocation's own
        // error union, none of which are actionable beyond showing a
        // non-error hint (issue #260: "拒絕/不支援時顯示提示文字不報錯").
        setUserLocation(null);
        setLocationState("denied");
      },
    );
  }, []);

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
          onClick={handleUseLocation}
          disabled={locationState === "loading"}
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-interactive-primary px-4 py-2 text-sm font-medium text-interactive-primary hover:bg-interactive-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {locationState === "loading" ? t("locatingLabel") : t("useLocationButton")}
        </button>
      </div>

      {locationState === "denied" && <p className="mb-4 text-sm text-ink-light">{t("locationDeniedMessage")}</p>}
      {locationState === "unsupported" && <p className="mb-4 text-sm text-ink-light">{t("locationUnsupportedMessage")}</p>}

      <PigeonGroupsMap groups={mapPoints} selectedId={selectedId} userLocation={userLocation} />

      {sortedGroups.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-white p-6 text-sm text-ink-light">{t("noResults")}</p>
      ) : (
        <ul className="mt-6 max-h-[600px] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-white">
          {sortedGroups.map((group) => {
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
    </div>
  );
}
