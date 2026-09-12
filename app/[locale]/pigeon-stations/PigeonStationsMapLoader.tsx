"use client";

// next/dynamic's `ssr: false` option is rejected by Next.js when called
// directly inside a Server Component — it has to originate in a Client
// Component. This one-line wrapper is that boundary: PigeonStationsMap.tsx
// itself imports the `leaflet` package, which touches `window`/`document`
// at module-evaluation time and would crash Next's server render pass if
// ever pulled into it.

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { PigeonStationMapPoint } from "./PigeonStationsMap";

const LazyPigeonStationsMap = dynamic(() => import("./PigeonStationsMap"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
});

function MapLoadingPlaceholder() {
  const t = useTranslations("pigeonStations");
  return (
    <div className="flex h-[420px] w-full items-center justify-center rounded-2xl border border-border bg-surface-muted text-sm text-ink-light sm:h-[480px]">
      {t("mapLoading")}
    </div>
  );
}

export type { PigeonStationMapPoint };
export default LazyPigeonStationsMap;
