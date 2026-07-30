"use client";

import { useEffect, useState } from "react";
import { formatRemaining } from "@/lib/format";
import { isPollableStatus, LISTING_STATUS_POLL_INTERVAL_MS, parseListingStatusResponse } from "@/lib/listingStatus";

// Renders the three fields that can change after the page has already
// loaded (current price via new bids, remaining time via anti-snipe
// extensions, and status once the auction closes), seeded from the
// server-rendered values so a plain page load/refresh with no JS still
// shows correct current state. While the listing is open, polls
// GET /api/listings/[id]/status on an interval and swaps these values in —
// no WebSockets/SSE, since the production reverse proxy can't stream
// (see .remote-index.php). If the poll fails (network hiccup, proxy blip,
// etc.) it silently keeps the last known-good values and retries next tick;
// it never throws or blanks the UI.
export default function LiveListingStatus({
  listingId,
  initialCurrentPrice,
  initialEndsAt,
  initialStatus,
}: {
  listingId: number;
  initialCurrentPrice: number;
  initialEndsAt: string;
  initialStatus: string;
}) {
  const [currentPrice, setCurrentPrice] = useState(initialCurrentPrice);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [status, setStatus] = useState(initialStatus);
  const [remainingLabel, setRemainingLabel] = useState(() => formatRemaining(new Date(initialEndsAt)));

  // Poll the status endpoint on an interval, only while there's something
  // left to change. Stops (no interval set) as soon as status flips away
  // from "open" — no point polling a closed listing.
  useEffect(() => {
    if (!isPollableStatus(status)) return;

    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/listings/${listingId}/status`, { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json().catch(() => null);
        const payload = parseListingStatusResponse(body);
        if (!payload || cancelled) return;

        setCurrentPrice(payload.currentPrice);
        setEndsAt(payload.endsAt);
        setStatus(payload.status);
      } catch {
        // Offline / proxy hiccup: keep showing the last known-good state
        // and just try again on the next tick.
      }
    }

    const intervalId = setInterval(poll, LISTING_STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [listingId, status]);

  // The remaining-time label depends on Date.now(), not just on endsAt, so
  // it needs its own re-render tick even between polls (otherwise "剩餘 5
  // 分鐘" would only update every 4s server-fetch and drift/looking stale
  // in between, or never flip to "已結束" promptly).
  useEffect(() => {
    setRemainingLabel(formatRemaining(new Date(endsAt)));
    const tickId = setInterval(() => setRemainingLabel(formatRemaining(new Date(endsAt))), 30_000);
    return () => clearInterval(tickId);
  }, [endsAt]);

  return (
    <>
      <li>目前價格：{currentPrice}</li>
      <li>{remainingLabel}</li>
      <li>狀態：{status === "open" ? "競標中" : "已結標"}</li>
    </>
  );
}
