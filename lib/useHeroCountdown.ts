"use client";

import { useEffect, useState } from "react";

const DAY_MS = 86_400_000;

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
 * Ticks every second once under a day remains, so a seconds display can
 * visibly count down; ticks once a minute above that, since a day/hour
 * display doesn't change more often and there's no reason to force a
 * re-render every second for something that won't visibly move. Each call
 * to this hook owns its own interval and its own re-renders — mount it only
 * inside a small leaf component (never inside HeroSection's own state) so a
 * tick re-renders just that leaf, not the hero's autoplay carousel/images.
 *
 * Seeded from `renderedAt` (captured once by the server component that
 * rendered this tree, so it's identical on the server-render pass and the
 * client's hydration pass) rather than calling Date.now() directly, to
 * avoid a hydration mismatch — same reasoning as useListingCountdown.
 */
export function useHeroCountdown(targetIso: string, renderedAt: string): HeroCountdownState {
  const [nowMs, setNowMs] = useState(() => new Date(renderedAt).getTime());
  const targetMs = new Date(targetIso).getTime();
  const remainingMs = Math.max(0, targetMs - nowMs);
  const tickMs = remainingMs < DAY_MS ? 1_000 : 60_000;

  useEffect(() => {
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), tickMs);
    return () => window.clearInterval(intervalId);
    // Re-sync immediately and restart the interval whenever the target
    // changes (e.g. the carousel switches to a different card) or the tick
    // rate itself changes (crossing the 1-day threshold).
  }, [targetIso, tickMs]);

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
