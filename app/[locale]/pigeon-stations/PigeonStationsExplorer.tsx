"use client";

// Client half of /pigeon-stations: owns which station is "selected" so a
// list-item click can tell the (also client-only, see
// PigeonStationsMapLoader.tsx) Leaflet map to fly to + open that marker's
// popup. The server component (page.tsx) only fetches data and renders
// static text around this.

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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

  // Only stations with a successful geocode (see scripts/import-pigeon-
  // stations.mjs's header comment on why lat/lng can be NULL) get a marker;
  // the list below still shows every station regardless.
  const mappable = useMemo(
    () =>
      stations.filter(
        (station): station is PigeonStationListItem & { lat: number; lng: number } =>
          station.lat !== null && station.lng !== null,
      ),
    [stations],
  );
  const hasUnmapped = mappable.length < stations.length;

  return (
    <div className="mt-6">
      <PigeonStationsMap stations={mappable} selectedId={selectedId} />
      {hasUnmapped && <p className="mt-2 text-xs text-ink-light">{t("unmappedNote")}</p>}

      <h2 className="mt-8 text-lg font-bold text-ink">{t("listTitle")}</h2>

      {stations.length === 0 ? (
        <p className="mt-3 text-sm text-ink-light">{t("noItems")}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stations.map((station) => {
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
