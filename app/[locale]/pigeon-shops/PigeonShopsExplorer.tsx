"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
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
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const mapPoints = useMemo<PigeonShopMapPoint[]>(
    () =>
      shops
        .filter((shop): shop is PigeonShopListItem & { lat: number; lng: number } => shop.lat !== null && shop.lng !== null)
        .map((shop) => ({ id: shop.id, name: shop.name, phone: shop.phone, address: shop.address, lat: shop.lat, lng: shop.lng })),
    [shops],
  );

  return (
    <div>
      <PigeonShopsMap shops={mapPoints} selectedId={selectedId} />

      <ul className="mt-6 max-h-[600px] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-white">
        {shops.map((shop) => {
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
                <span className="text-sm font-bold text-ink">{shop.name}</span>
                <span className="text-sm text-ink-light">{shop.phone ?? noPhoneLabel}</span>
                <span className="text-sm text-ink-light">{shop.address ?? noAddressLabel}</span>
                {!hasCoordinates && <span className="text-xs text-ink-light">{noCoordinatesLabel}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
