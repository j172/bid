"use client";

// Client half of /pigeon-stations: owns which station is "selected" (so a
// list-item click can tell the (also client-only, see
// PigeonStationsMapLoader.tsx) Leaflet map to fly to + open that marker's
// popup) plus the search + county filter state (issue #256), shared with
// /pigeon-shops via lib/pigeonDirectoryFilters.ts. The server component
// (page.tsx) only fetches data and renders static text around this.

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ALL_COUNTIES_VALUE, filterPigeonDirectoryEntries, listPresentCounties } from "@/lib/pigeonDirectoryFilters";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [county, setCounty] = useState<string>(ALL_COUNTIES_VALUE);

  // Issue #256: county options only ever list counties that actually occur
  // in `stations` — computed from the full, unfiltered list so switching the
  // search text never makes county options disappear out from under the
  // dropdown.
  const counties = useMemo(() => listPresentCounties(stations), [stations]);

  const filteredStations = useMemo(
    () => filterPigeonDirectoryEntries(stations, { searchQuery, county }),
    [stations, searchQuery, county],
  );

  // Only stations with a successful geocode (see scripts/import-pigeon-
  // stations.mjs's header comment on why lat/lng can be NULL) get a marker;
  // the list below still shows every filtered station regardless.
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
      </div>

      <div className="mt-4">
        <PigeonStationsMap stations={mappable} selectedId={selectedId} />
      </div>
      {hasUnmapped && <p className="mt-2 text-xs text-ink-light">{t("unmappedNote")}</p>}

      <h2 className="mt-8 text-lg font-bold text-ink">{t("listTitle")}</h2>

      {filteredStations.length === 0 ? (
        <p className="mt-3 text-sm text-ink-light">{stations.length === 0 ? t("noItems") : t("noResults")}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStations.map((station) => {
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
                <p className="font-semibold text-ink">{station.name}</p>
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
    </div>
  );
}
