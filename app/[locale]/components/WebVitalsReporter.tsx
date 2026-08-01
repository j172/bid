"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useReportWebVitals } from "next/web-vitals";

type MetricSnapshot = {
  value: number;
  rating: "good" | "needs-improvement" | "poor";
};

type MetricMap = Partial<Record<"LCP" | "CLS" | "INP" | "FCP" | "TTFB", MetricSnapshot>>;

export default function WebVitalsReporter() {
  const searchParams = useSearchParams();
  const [metrics, setMetrics] = useState<MetricMap>({});

  const enabled = searchParams.has("wv");
  const perfMode = searchParams.get("perf") === "aggressive" ? "aggressive" : "balanced";

  useReportWebVitals((metric) => {
    if (typeof window === "undefined") return;
    if (!enabled) return;

    if (metric.name === "LCP" || metric.name === "CLS" || metric.name === "INP" || metric.name === "FCP" || metric.name === "TTFB") {
      setMetrics((previous) => ({
        ...previous,
        [metric.name]: { value: metric.value, rating: metric.rating },
      }));
    }

    console.info("[WebVitals]", {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
    });
  });

  const rows = useMemo(
    () =>
      (["LCP", "CLS", "INP", "FCP", "TTFB"] as const).map((name) => ({
        name,
        snapshot: metrics[name],
      })),
    [metrics],
  );

  if (!enabled) return null;

  return (
    <aside className="fixed bottom-3 right-3 z-50 w-64 rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">Web Vitals</p>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
            perfMode === "aggressive" ? "bg-orange-500/25 text-orange-200" : "bg-blue-500/25 text-blue-200"
          }`}
        >
          {perfMode}
        </span>
      </div>

      <div className="space-y-1.5">
        {rows.map(({ name, snapshot }) => (
          <div key={name} className="flex items-center justify-between rounded bg-slate-800/80 px-2 py-1">
            <span className="font-mono text-[11px]">{name}</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px]">{snapshot ? snapshot.value.toFixed(2) : "--"}</span>
              <span
                className={`rounded px-1 py-0.5 text-[10px] ${
                  !snapshot
                    ? "bg-slate-700 text-slate-300"
                    : snapshot.rating === "good"
                      ? "bg-emerald-500/25 text-emerald-200"
                      : snapshot.rating === "needs-improvement"
                        ? "bg-amber-500/25 text-amber-200"
                        : "bg-rose-500/25 text-rose-200"
                }`}
              >
                {snapshot?.rating ?? "pending"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
