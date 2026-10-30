// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RetryableImage from "./RetryableImage";
import { IMAGE_FALLBACK_SRC } from "@/lib/shared/content/imageFallback";

const RETRY_DELAY_MS = 800;

afterEach(() => {
  vi.useRealTimers();
});

describe("RetryableImage", () => {
  it("retries a failed image once and only then switches to the project placeholder", () => {
    vi.useFakeTimers();
    const src = "/uploads/club-award-pigeons/pigeon.webp";
    render(<RetryableImage src={src} alt="award pigeon" />);

    const image = screen.getByAltText("award pigeon");
    expect(image.getAttribute("src")).toBe(src);

    fireEvent.error(image);
    act(() => vi.advanceTimersByTime(RETRY_DELAY_MS));
    expect(image.getAttribute("src")).toBe(`${src}?__retry=1`);

    fireEvent.error(image);
    expect(image.getAttribute("src")).toBe(IMAGE_FALLBACK_SRC);

    fireEvent.error(image);
    expect(image.getAttribute("src")).toBe(IMAGE_FALLBACK_SRC);
  });
});
