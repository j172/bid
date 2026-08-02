"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatRemaining } from "@/lib/format";
import { isPollableStatus, LISTING_STATUS_POLL_INTERVAL_MS, parseListingStatusResponse } from "@/lib/listingStatus";
import StatusBadge from "../../components/StatusBadge";

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
  initialStartsAt,
  initialStatus,
}: {
  listingId: number;
  initialCurrentPrice: number;
  initialEndsAt: string;
  /** ISO 8601 string, or null — set only while status is 'scheduled'. */
  initialStartsAt: string | null;
  initialStatus: string;
}) {
  const t = useTranslations("format");
  const [currentPrice, setCurrentPrice] = useState(initialCurrentPrice);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [status, setStatus] = useState(initialStatus);

  // While still 'scheduled', count down to the start time instead of the end
  // time — showing "剩餘 X" (ends_at) on a listing that hasn't opened yet
  // would be actively misleading. Once the poll below reports status flipping
  // to 'open' (the server-side sweep does this once starts_at passes), this
  // automatically switches to the normal end-time countdown.
  const showingCountdownToStart = status === "scheduled" && startsAt !== null;
  const countdownTarget = showingCountdownToStart ? startsAt! : endsAt;
  const [remainingLabel, setRemainingLabel] = useState(() =>
    formatRemaining(
      new Date(countdownTarget),
      t,
      showingCountdownToStart ? { prefixKey: "startsInPrefix", endedKey: "startingSoon" } : undefined,
    ),
  );

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
        setStartsAt(payload.startsAt);
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

  // The remaining-time label depends on Date.now(), not just on the target
  // date, so it needs its own re-render tick even between polls (otherwise
  // the label would only update every 4s server-fetch and drift/looking
  // stale in between, or never flip to "ended"/"startingSoon" promptly).
  useEffect(() => {
    const options = showingCountdownToStart ? { prefixKey: "startsInPrefix", endedKey: "startingSoon" } : undefined;
    const tick = () => setRemainingLabel(formatRemaining(new Date(countdownTarget), t, options));
    tick();
    const tickId = setInterval(tick, 30_000);
    return () => clearInterval(tickId);
  }, [countdownTarget, showingCountdownToStart, t]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gold">{currentPrice}</span>
        <StatusBadge status={status} />
      </div>
      <p className="text-sm text-ink-light">{remainingLabel}</p>
    </div>
  );
}
