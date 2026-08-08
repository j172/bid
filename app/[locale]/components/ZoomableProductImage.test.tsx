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

describe("ZoomableProductImage load timeout fallback", () => {
  // Regression test for issue #99: some listing thumbnails intermittently
  // fire neither `onLoad` nor `onError` on the underlying <img>, leaving it
  // stuck at opacity-0 forever even though the file itself is fine. A
  // timeout safety net should apply the same fallback path `onError` uses.
  it("falls back to FALLBACK_SRC if neither onLoad nor onError fires in time", () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;
    expect(img.src).toContain("/uploads/listings/48/example.webp");

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

  it("does not fall back if onError already fired before the timeout", () => {
    vi.useFakeTimers();
    render(<ZoomableProductImage src="/uploads/listings/48/example.webp" alt="example" />);

    const img = screen.getByAltText("example") as HTMLImageElement;

    act(() => {
      fireEvent.error(img);
    });
    expect(img.src).toContain("hero-placeholder.png");

    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(img.src).toContain("hero-placeholder.png");
  });
});
