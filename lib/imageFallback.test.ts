// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IMAGE_FALLBACK_SRC,
  resolveImageSrc,
  shouldBypassImageOptimizer,
  useImageFallback,
  useImageSetFallback,
} from "./imageFallback";

afterEach(() => {
  vi.useRealTimers();
});

// Matches lib/imageFallback.ts's RETRY_DELAY_MS. Not exported (it's an
// internal timing detail), so it's duplicated here the same way
// ZoomableProductImage.test.tsx duplicates that component's own timeouts.
const RETRY_DELAY_MS = 800;

describe("resolveImageSrc", () => {
  it("passes a healthy src straight through", () => {
    expect(resolveImageSrc("/uploads/listings/1/a.webp", false)).toBe("/uploads/listings/1/a.webp");
  });

  it("swaps in the placeholder once the src has failed", () => {
    expect(resolveImageSrc("/uploads/listings/1/a.webp", true)).toBe(IMAGE_FALLBACK_SRC);
  });
});

describe("shouldBypassImageOptimizer", () => {
  it("bypasses Next's optimizer for uploaded files", () => {
    expect(shouldBypassImageOptimizer("/uploads/listings/1/a.webp")).toBe(true);
    expect(shouldBypassImageOptimizer("https://example.com/uploads/x.webp")).toBe(true);
  });

  it("keeps optimizing bundled static assets", () => {
    expect(shouldBypassImageOptimizer(IMAGE_FALLBACK_SRC)).toBe(false);
    expect(shouldBypassImageOptimizer("/images/logo.png")).toBe(false);
  });
});

// Issue #171: a single `onError` used to mark a URL permanently failed for
// the rest of the page view — a transient blip (connection-limit stall,
// optimizer cold start) became a stuck placeholder until the user refreshed.
// These cover the fix: one retry before giving up, and that a genuinely
// broken image still stably falls back rather than retrying forever.
describe("useImageFallback retry behaviour", () => {
  const src = "/uploads/listings/1/a.webp";

  it("does not fall back on the first markFailed — it keeps showing the real src", () => {
    const { result } = renderHook(() => useImageFallback(src));

    act(() => {
      result.current.markFailed();
    });

    expect(result.current.displaySrc).not.toBe(IMAGE_FALLBACK_SRC);
    expect(result.current.displaySrc.startsWith(src)).toBe(true);
  });

  it("retries under a new URL after the delay, and recovers with no further markFailed calls", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useImageFallback(src));

    act(() => {
      result.current.markFailed();
    });
    const beforeRetry = result.current.displaySrc;

    act(() => {
      vi.advanceTimersByTime(RETRY_DELAY_MS);
    });

    // A genuinely different URL — reassigning the identical string wouldn't
    // make the browser (or React's prop diffing) try again.
    expect(result.current.displaySrc).not.toBe(beforeRetry);
    expect(result.current.displaySrc).not.toBe(IMAGE_FALLBACK_SRC);
    expect(result.current.displaySrc.startsWith(src)).toBe(true);

    // The retry never errored, so nothing ever escalates to the placeholder.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.displaySrc).not.toBe(IMAGE_FALLBACK_SRC);
  });

  it("still falls back to the placeholder if the retry also fails — no infinite retry loop", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useImageFallback(src));

    act(() => {
      result.current.markFailed();
    });
    act(() => {
      vi.advanceTimersByTime(RETRY_DELAY_MS);
    });
    expect(result.current.displaySrc).not.toBe(IMAGE_FALLBACK_SRC);

    act(() => {
      result.current.markFailed();
    });
    expect(result.current.displaySrc).toBe(IMAGE_FALLBACK_SRC);

    // Permanent: further markFailed calls (and time passing) don't schedule
    // another retry or otherwise change anything.
    act(() => {
      result.current.markFailed();
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.displaySrc).toBe(IMAGE_FALLBACK_SRC);
  });

  it("never marks the placeholder src itself as failed (guards against a missing placeholder file looping)", () => {
    const { result } = renderHook(() => useImageFallback(IMAGE_FALLBACK_SRC));

    act(() => {
      result.current.markFailed();
    });

    expect(result.current.displaySrc).toBe(IMAGE_FALLBACK_SRC);
  });

  it("resets retry/failed state when src changes (e.g. a carousel advancing slides)", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ currentSrc }) => useImageFallback(currentSrc), {
      initialProps: { currentSrc: src },
    });

    act(() => {
      result.current.markFailed();
    });
    act(() => {
      vi.advanceTimersByTime(RETRY_DELAY_MS);
    });
    act(() => {
      result.current.markFailed();
    });
    expect(result.current.displaySrc).toBe(IMAGE_FALLBACK_SRC);

    const nextSrc = "/uploads/listings/2/b.webp";
    rerender({ currentSrc: nextSrc });

    expect(result.current.displaySrc).toBe(nextSrc);
  });
});

describe("useImageSetFallback retry behaviour", () => {
  const urlA = "/uploads/listings/1/a.webp";
  const urlB = "/uploads/listings/1/b.webp";

  it("retries a failed URL once before falling back, independently of other URLs", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useImageSetFallback());

    act(() => {
      result.current.markFailed(urlA);
    });
    // Untouched URL is unaffected by A's failure.
    expect(result.current.resolveSrc(urlB)).toBe(urlB);
    expect(result.current.resolveSrc(urlA)).not.toBe(IMAGE_FALLBACK_SRC);

    act(() => {
      vi.advanceTimersByTime(RETRY_DELAY_MS);
    });
    // A recovered (no second markFailed) — still not the placeholder, and B
    // was never touched by A's retry.
    expect(result.current.resolveSrc(urlA)).not.toBe(IMAGE_FALLBACK_SRC);
    expect(result.current.resolveSrc(urlB)).toBe(urlB);
  });

  it("falls back a URL to the placeholder only once its retry also fails", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useImageSetFallback());

    act(() => {
      result.current.markFailed(urlA);
      vi.advanceTimersByTime(RETRY_DELAY_MS);
    });
    expect(result.current.resolveSrc(urlA)).not.toBe(IMAGE_FALLBACK_SRC);

    act(() => {
      result.current.markFailed(urlA);
    });
    expect(result.current.resolveSrc(urlA)).toBe(IMAGE_FALLBACK_SRC);

    // Permanent, and B (never failed) is still unaffected.
    expect(result.current.resolveSrc(urlB)).toBe(urlB);
  });

  it("never marks the placeholder URL itself as failed", () => {
    const { result } = renderHook(() => useImageSetFallback());

    act(() => {
      result.current.markFailed(IMAGE_FALLBACK_SRC);
    });

    expect(result.current.resolveSrc(IMAGE_FALLBACK_SRC)).toBe(IMAGE_FALLBACK_SRC);
  });
});
