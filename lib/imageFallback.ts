"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared "this image didn't load, show the placeholder instead" core
// (issue #139 item 12; retry-before-giving-up added for issue #171).
//
// Three components had grown three different implementations of the same
// idea: ProgressiveImage kept an `errored` boolean, ZoomableProductImage
// kept the same boolean plus a settle timeout, and ListingGallery tracked a
// Set of failed URLs because it renders many images at once. The outer
// interaction behaviour genuinely differs between them (a fade-in, a zoom
// lens, a lightbox) and stays where it is — only the fallback bookkeeping
// and the "should Next optimize this?" test are shared.

export const IMAGE_FALLBACK_SRC = "/images/hero-placeholder.png";

/** Pure form of the fallback decision — exported for the two hooks below and for tests. */
export function resolveImageSrc(src: string, failed: boolean): string {
  return failed ? IMAGE_FALLBACK_SRC : src;
}

/**
 * Uploaded files are served straight from disk and must bypass Next's image
 * optimizer (they are already WebP-converted on upload — see
 * lib/convertPhotoToWebp.ts).
 */
export function shouldBypassImageOptimizer(src: string): boolean {
  return src.includes("/uploads/");
}

// A single `onError` isn't proof an image is actually broken — the file is
// usually fine and the browser just hit something transient (a
// concurrent-connection-limit stall, the image optimizer's own upstream
// fetch timing out, a dropped packet). Falling back to the placeholder on
// the first `onError` turned one-off blips into a permanently wrong
// thumbnail for the rest of the page view, until the user refreshed
// (issue #171). So `onError` now buys the image one retry, after a short
// delay, before the bookkeeping below calls it genuinely broken.
const RETRY_DELAY_MS = 800;

/**
 * Re-requests `src` under a new URL, since reassigning the exact same
 * string does nothing: the browser doesn't retry a request that already
 * failed for that URL, and React skips the DOM update entirely because the
 * prop didn't change. Harmless for every path these hooks are used with —
 * `app/uploads/[...path]/route.ts` ignores the query string outright, and
 * Next's image optimizer just refetches whatever URL it's given.
 */
function withRetryMarker(src: string, isRetry: boolean): string {
  if (!isRetry) return src;
  return `${src}${src.includes("?") ? "&" : "?"}__retry=1`;
}

/** One URL's progress through "first try" → "one retry" → "gave up". */
interface AttemptState {
  /** Whether the one-time retry has been kicked off (in flight, or done). */
  retried: boolean;
  /** Set once the retry has *also* failed — permanent until `src`/the URL resets. */
  failed: boolean;
}

const INITIAL_ATTEMPT_STATE: AttemptState = { retried: false, failed: false };

export interface SingleImageFallback {
  /** `src` (or its retry), or the placeholder once both attempts have failed. */
  displaySrc: string;
  /** Whether `displaySrc` should skip Next's optimizer. */
  unoptimized: boolean;
  /**
   * Call from `onError`. The first call schedules a single retry instead of
   * failing outright; a no-op once already showing the placeholder, so a
   * missing placeholder file can't loop.
   */
  markFailed: () => void;
}

/**
 * Fallback state for a component showing one image at a time.
 *
 * Resets on every `src` change: a carousel (HeroSection) reuses the same
 * component instance across slides, so a failure on one image must not
 * permanently fall back every slide after it.
 */
export function useImageFallback(src: string): SingleImageFallback {
  const [state, setState] = useState<AttemptState>(INITIAL_ATTEMPT_STATE);
  // Read synchronously inside markFailed/the retry timeout, where the
  // `state` closed over by a stale useCallback would otherwise lie about
  // whether a retry is already in flight.
  const stateRef = useRef(state);
  stateRef.current = state;
  const retryTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setState(INITIAL_ATTEMPT_STATE);
    return () => {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    };
  }, [src]);

  const displaySrc = resolveImageSrc(withRetryMarker(src, state.retried), state.failed);

  const markFailed = useCallback(() => {
    if (src === IMAGE_FALLBACK_SRC) return;
    const current = stateRef.current;
    if (current.failed || retryTimeoutRef.current !== undefined) return;

    if (!current.retried) {
      retryTimeoutRef.current = window.setTimeout(() => {
        retryTimeoutRef.current = undefined;
        setState((latest) => (latest.retried || latest.failed ? latest : { retried: true, failed: false }));
      }, RETRY_DELAY_MS);
      return;
    }

    // The retry failed too — this one's actually broken.
    setState({ retried: true, failed: true });
  }, [src]);

  return { displaySrc, unoptimized: shouldBypassImageOptimizer(displaySrc), markFailed };
}

export interface ImageSetFallback {
  /** `url` (or its retry), or the placeholder if that url has failed twice. */
  resolveSrc: (url: string) => string;
  /** Call from a given image's `onError`. */
  markFailed: (url: string) => void;
}

/**
 * Fallback state for a component showing many images at once (the listing
 * gallery: one main image plus a thumbnail strip plus a lightbox, all
 * potentially showing different URLs). Failures — and retries — are tracked
 * per URL so one broken photo doesn't blank the rest, and a retry on one
 * URL never touches any other.
 */
export function useImageSetFallback(): ImageSetFallback {
  const [states, setStates] = useState<Map<string, AttemptState>>(() => new Map());
  const statesRef = useRef(states);
  statesRef.current = states;
  const retryTimeoutsRef = useRef<Map<string, number>>(new Map());

  useEffect(
    () => () => {
      retryTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      retryTimeoutsRef.current.clear();
    },
    [],
  );

  const resolveSrc = useCallback(
    (url: string) => {
      const state = states.get(url) ?? INITIAL_ATTEMPT_STATE;
      return resolveImageSrc(withRetryMarker(url, state.retried), state.failed);
    },
    [states],
  );

  const markFailed = useCallback((url: string) => {
    if (url === IMAGE_FALLBACK_SRC) return;
    const current = statesRef.current.get(url) ?? INITIAL_ATTEMPT_STATE;
    if (current.failed || retryTimeoutsRef.current.has(url)) return;

    if (!current.retried) {
      const timeoutId = window.setTimeout(() => {
        retryTimeoutsRef.current.delete(url);
        setStates((previous) => {
          const latest = previous.get(url) ?? INITIAL_ATTEMPT_STATE;
          if (latest.retried || latest.failed) return previous;
          const next = new Map(previous);
          next.set(url, { retried: true, failed: false });
          return next;
        });
      }, RETRY_DELAY_MS);
      retryTimeoutsRef.current.set(url, timeoutId);
      return;
    }

    // The retry failed too — this URL's actually broken.
    setStates((previous) => {
      const next = new Map(previous);
      next.set(url, { retried: true, failed: true });
      return next;
    });
  }, []);

  return { resolveSrc, markFailed };
}
