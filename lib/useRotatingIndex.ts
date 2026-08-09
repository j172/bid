"use client";

import { useEffect, useState } from "react";

// Auto-advancing carousel index, shared by NewsCarouselCard and
// PigeonShowcaseCarouselCard (issue #139 item 10) — both had the identical
// useState(0) + setInterval(() => (prev + 1) % length) pair.
//
// A single item (or none) never starts a timer: there is nothing to rotate
// to, and an interval that only ever re-sets the same value would re-render
// the card forever for no reason.
//
// Deliberately does *not* clamp the index when `length` shrinks — matching
// the behaviour of both components before the extraction. The homepage
// renders these from a server component, so the item list is fixed for the
// life of the mount.
export function useRotatingIndex(length: number, intervalMs: number): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (length <= 1) return;
    const timer = setInterval(() => setIndex((previous) => (previous + 1) % length), intervalMs);
    return () => clearInterval(timer);
  }, [length, intervalMs]);

  return index;
}
