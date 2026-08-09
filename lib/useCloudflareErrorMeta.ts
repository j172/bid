"use client";

import { useEffect, useState } from "react";
import { getClientIpAction } from "@/lib/actions/getClientIp";
import { getRayIdAction } from "@/lib/actions/getRayId";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { generateRayId } from "@/lib/rayId";

// The Ray ID / client IP / timestamp trio shown on both error pages
// (issue #139 item 14) — app/[locale]/error.tsx and app/global-error.tsx had
// grown two near-identical ~15-line useEffects.
//
// Deliberately free of any next-intl dependency: global-error.tsx renders
// *instead of* the root layout, so nothing above it survives, including
// <NextIntlClientProvider>. This hook must stay usable from there.
//
// Everything is filled in after mount rather than during render. These
// components are still server-rendered for the first HTML response when the
// triggering error happens during SSR, and awaiting either server action
// there would make that server-rendered value disagree with the value
// produced when the same component re-runs during client hydration — a React
// hydration mismatch. Starting from null on both sides and filling in via
// useEffect (which only runs after hydration) avoids that entirely.

export interface CloudflareErrorMeta {
  /** Null until resolved — render a placeholder ("…") meanwhile. */
  rayId: string | null;
  clientIp: string | null;
  timestamp: string | null;
}

export function useCloudflareErrorMeta(error: Error): CloudflareErrorMeta {
  const [rayId, setRayId] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);

  useEffect(() => {
    // Logged client-side so the underlying error is still visible during
    // development / in the browser console — the pages themselves only ever
    // show the visitor a generic message, never `error.message`.
    console.error(error);

    getRayIdAction()
      .then((id) => setRayId(id))
      // Server Action unreachable (e.g. offline) — fall back to the same
      // cosmetic random id these pages always showed before issue #127
      // rather than leaving the "…" placeholder up forever.
      .catch(() => setRayId(generateRayId()));
    setTimestamp(formatUtcTimestamp(new Date()));
    getClientIpAction()
      .then((ip) => setClientIp(ip))
      .catch(() => setClientIp(null));
  }, [error]);

  return { rayId, clientIp, timestamp };
}
