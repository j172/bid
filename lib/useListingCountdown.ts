"use client";

import { useEffect, useState } from "react";
import { isPollableStatus, LISTING_STATUS_POLL_INTERVAL_MS, parseListingStatusResponse } from "@/lib/listingStatus";

// Digit-tile countdowns (the hero strip) need to visibly tick every second;
// the plain-text countdown (LiveListingStatus) only needs minute-level
// accuracy but re-renders on the same 1s tick anyway since it's just a
// cheap text reformat — not worth maintaining two tick rates for one shared
// hook.
const COUNTDOWN_TICK_MS = 1_000;

export interface ListingCountdownState {
  currentPrice: number;
  status: string;
  endsAt: string;
  startsAt: string | null;
  /** True while counting down to startsAt instead of endsAt (status === 'scheduled'). */
  showingCountdownToStart: boolean;
  /** ISO string being counted down to. */
  countdownTarget: string;
  /** Milliseconds remaining until countdownTarget, clamped to >= 0, updated every second. */
  remainingMs: number;
}

// Owns the live-updating parts of a listing (current price, end/start time,
// status), seeded from server-rendered initial values so a no-JS page load
// still shows correct state. Polls GET /api/listings/[id]/status on an
// interval while the listing is still pollable — no WebSockets/SSE, since
// the production reverse proxy can't stream (see .remote-index.php). If the
// poll fails (network hiccup, proxy blip, etc.) it silently keeps the last
// known-good values and retries next tick; it never throws or blanks the UI.
//
// Shared by LiveListingStatus (plain-text rendering) and the hero
// countdown strip (digit-tile rendering) so there's exactly one poller per
// mounted instance of each — not one poller duplicated across components.
export function useListingCountdown({
  listingId,
  initialCurrentPrice,
  initialEndsAt,
  initialStartsAt,
  initialStatus,
  renderedAt,
}: {
  listingId: number;
  initialCurrentPrice: number;
  initialEndsAt: string;
  /** ISO 8601 string, or null — set only while status is 'scheduled'. */
  initialStartsAt: string | null;
  initialStatus: string;
  /**
   * ISO 8601 string captured once by the server component that rendered
   * this tree. Seeding `nowMs` from this (a prop, so identical on the
   * server-render pass and the client's hydration pass) rather than calling
   * Date.now() directly avoids a hydration mismatch — Date.now() returns a
   * genuinely different value in each environment, and at this hook's
   * second-level display granularity that's enough to flip the rendered
   * digit almost every time. The mount effect below corrects nowMs to the
   * real client clock immediately after hydration completes.
   */
  renderedAt: string;
}): ListingCountdownState {
  const [currentPrice, setCurrentPrice] = useState(initialCurrentPrice);
  const [endsAt, setEndsAt] = useState(initialEndsAt);
  const [startsAt, setStartsAt] = useState(initialStartsAt);
  const [status, setStatus] = useState(initialStatus);
  const [nowMs, setNowMs] = useState(() => new Date(renderedAt).getTime());

  // While still 'scheduled', count down to the start time instead of the end
  // time — showing "剩餘 X" (ends_at) on a listing that hasn't opened yet
  // would be actively misleading. Once the poll below reports status flipping
  // to 'open' (the server-side sweep does this once starts_at passes), this
  // automatically switches to the normal end-time countdown.
  const showingCountdownToStart = status === "scheduled" && startsAt !== null;
  const countdownTarget = showingCountdownToStart ? startsAt! : endsAt;

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

  // remainingMs depends on Date.now(), not just on the target date, so it
  // needs its own re-render tick even between polls.
  useEffect(() => {
    setNowMs(Date.now());
    const tickId = setInterval(() => setNowMs(Date.now()), COUNTDOWN_TICK_MS);
    return () => clearInterval(tickId);
  }, [countdownTarget]);

  const remainingMs = Math.max(0, new Date(countdownTarget).getTime() - nowMs);

  return { currentPrice, status, endsAt, startsAt, showingCountdownToStart, countdownTarget, remainingMs };
}
