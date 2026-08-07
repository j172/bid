"use client";

import { useEffect, useState } from "react";

// Fixed 1s tick, matching lib/useListingCountdown.ts's COUNTDOWN_TICK_MS.
//
// issue #71 regression: an earlier version of this hook computed a variable
// tick rate — 1s once under a day remained, 60s above that — reasoning that
// a day/hour-granularity display "won't visibly move" between ticks, so
// ticking it every second would be wasted work. That reasoning doesn't hold
// for either of this hook's two call sites in HeroSection.tsx:
//  - EndTimeCountdown (the digit tiles) always renders a seconds tile, so
//    throttling to a 60s tick left that tile visibly frozen for up to a
//    minute at a stretch on any listing with >= 1 day remaining — which, in
//    practice, is most listings most of the time. That's the "static, not
//    ticking" regression reported against #58's original acceptance.
//  - RemainingText (the "剩餘 X 天 X 小時" sentence) already drops the
//    minutes/seconds fields from its own *rendered text* once a day or more
//    remains (see the `days > 0` branch in HeroSection.tsx) — so ticking
//    its state every second regardless just re-runs a cheap string format
//    that produces the same output most of the time. No visible churn, and
//    per useListingCountdown's own comment on LiveListingStatus: not worth
//    maintaining two tick rates for one shared hook.
const TICK_MS = 1_000;

export interface HeroCountdownState {
  /** Milliseconds remaining until the target, clamped to >= 0. */
  remainingMs: number;
  ended: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Live-ticking countdown to `targetIso`, for the homepage hero section's two
 * "remaining time" displays (the active card's end-time digit tiles and the
 * secondary card list's "剩餘 X 天/時" text). Modeled on the tick effect in
 * lib/useListingCountdown.ts (see that file), but deliberately kept separate
 * and leaner: the listing detail page's hook also polls a status endpoint
 * for live price/status, which the hero section has no need for — it only
 * needs a moving clock against server-supplied end times. Do not point the
 * listing detail page at this hook, and do not fold this into
 * useListingCountdown; they're intentionally two hooks for two call sites.
 *
 * Ticks every second, unconditionally (see TICK_MS above for why a
 * remaining-time-dependent tick rate doesn't work here). Each call to this
 * hook owns its own interval and its own re-renders — mount it only inside
 * a small leaf component (never inside HeroSection's own state) so a tick
 * re-renders just that leaf, not the hero's autoplay carousel/images.
 *
 * Seeded from `renderedAt` (captured once by the server component that
 * rendered this tree, so it's identical on the server-render pass and the
 * client's hydration pass) rather than calling Date.now() directly, to
 * avoid a hydration mismatch — same reasoning as useListingCountdown.
 */
export function useHeroCountdown(targetIso: string, renderedAt: string): HeroCountdownState {
  const [nowMs, setNowMs] = useState(() => new Date(renderedAt).getTime());

  useEffect(() => {
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => window.clearInterval(intervalId);
    // Re-sync immediately and restart the interval whenever the target
    // changes (e.g. the carousel switches to a different card).
  }, [targetIso]);

  const targetMs = new Date(targetIso).getTime();
  const remainingMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(remainingMs / 1000);
  return {
    remainingMs,
    ended: remainingMs <= 0,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}
