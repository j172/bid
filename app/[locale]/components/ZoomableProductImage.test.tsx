// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import ZoomableProductImage from "./ZoomableProductImage";

// jsdom doesn't implement matchMedia; ZoomableProductImage reads it on mount
// to decide reduced-motion/hover behavior, unrelated to what these tests
// exercise, so it's stubbed out to a stable "no preference" match.
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// Advances fake timers through a full "neither onLoad nor onError ever
// fires" round trip: the first 7s watchdog gives up and starts
// useImageFallback's one-time retry (issue #171), the retry is likewise
// silent, and its own re-armed 7s watchdog is what finally gives up for
// real. Used by the tests below that need to reach the placeholder without
// ever firing a real load/error event.
function advanceThroughSilentRetry() {
  act(() => {
    vi.advanceTimersByTime(7000);
  });
  act(() => {
    vi.advanceTimersByTime(800);
  });
  act(() => {
    vi.advanceTimersByTime(7000);
  });
}

describe("ZoomableProductImage load timeout fallback", () => {
  // Regression test for issue #99: some listing thumbnails intermittently
  // fire neither `onLoad` nor `onError` on the underlying <img>, leaving it
  // stuck at opacity-0 forever even though the file itself is fine. A
  // timeout safety net should apply the same fallback path `onError` uses —
  // which, since issue #171, includes that path's own one-time retry.
  it("falls back to FALLBACK_SRC if neither onLoad nor onError fires in time, once the retry also times out", () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;
    expect(img.src).toContain("/uploads/listings/48/example.webp");

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    // The first watchdog gives up and starts the retry — not the
    // placeholder yet.
    expect(img.src).not.toContain("hero-placeholder.png");

    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(img.src).toContain("hero-placeholder.png");
  });

  it("does not fall back if onLoad fires before the timeout", async () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;

    // next/image's onLoad wrapper resolves via `img.decode()` (a microtask),
    // not synchronously, so flush microtasks before asserting.
    await act(async () => {
      fireEvent.load(img);
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(img.src).toContain("/uploads/listings/48/example.webp");
    expect(img.className).toContain("opacity-100");
  });

  it("does not fall back on the first onError — it retries the same image once instead (issue #171)", () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;

    act(() => {
      fireEvent.error(img);
    });
    // Still the real photo immediately after the first onError — a single
    // failure buys a retry (lib/imageFallback.ts's RETRY_DELAY_MS), not an
    // instant, permanent fallback.
    expect(img.src).toContain("/uploads/listings/48/example.webp");
    expect(img.src).not.toContain("hero-placeholder.png");

    act(() => {
      vi.advanceTimersByTime(800);
    });
    // The retry re-requests the same file under a cache-busting query
    // param, not the placeholder.
    expect(img.src).toContain("/uploads/listings/48/example.webp");
    expect(img.src).not.toContain("hero-placeholder.png");

    // The retry's own 7s watchdog re-arms for this new request — it
    // shouldn't fire early just because the first attempt's window already
    // elapsed.
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(img.src).not.toContain("hero-placeholder.png");
  });

  it("falls back only once the retry also fails", () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;

    act(() => {
      fireEvent.error(img);
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(img.src).not.toContain("hero-placeholder.png");

    act(() => {
      fireEvent.error(img);
    });
    expect(img.src).toContain("hero-placeholder.png");

    // Permanent from here — no further retries.
    act(() => {
      fireEvent.error(img);
    });
    expect(img.src).toContain("hero-placeholder.png");
  });

  it("recovers if the retry succeeds — no fallback, no refresh needed", async () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;

    act(() => {
      fireEvent.error(img);
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });

    await act(async () => {
      fireEvent.load(img);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(img.src).toContain("/uploads/listings/48/example.webp");
    expect(img.src).not.toContain("hero-placeholder.png");
    expect(img.className).toContain("opacity-100");

    // No lingering watchdog waiting to undo the recovery.
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(img.src).not.toContain("hero-placeholder.png");
  });

  // Regression test for issue #155 item 5: if the same "neither onLoad nor
  // onError ever fires" failure mode also hits the placeholder <img> itself
  // (after the 7s timeout above has already switched to it), `loaded` must
  // still eventually flip to true instead of leaving the card permanently
  // invisible (opacity-0, not a broken-image icon — worse, since nothing
  // ever tells the user something's wrong).
  it("still becomes visible if the placeholder image itself never fires onLoad/onError", () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;

    advanceThroughSilentRetry();
    expect(img.src).toContain("hero-placeholder.png");
    expect(img.className).toContain("opacity-0");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(img.className).toContain("opacity-100");
  });

  it("does not force-show early if the placeholder's onLoad fires before its own timeout", async () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;

    advanceThroughSilentRetry();
    expect(img.src).toContain("hero-placeholder.png");

    await act(async () => {
      fireEvent.load(img);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(img.className).toContain("opacity-100");
  });
});
