import { describe, expect, it } from "vitest";
import { IMAGE_FALLBACK_SRC, resolveImageSrc, shouldBypassImageOptimizer } from "./imageFallback";

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
