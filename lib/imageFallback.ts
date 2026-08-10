"use client";

import { useCallback, useEffect, useState } from "react";

// Shared "this image didn't load, show the placeholder instead" core
// (issue #139 item 12).
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

export interface SingleImageFallback {
  /** `src`, or the placeholder once this src has failed. */
  displaySrc: string;
  /** Whether `displaySrc` should skip Next's optimizer. */
  unoptimized: boolean;
  /**
   * Call from `onError`. A no-op once already showing the placeholder, so a
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const displaySrc = resolveImageSrc(src, failed);

  const markFailed = useCallback(() => {
    setFailed((current) => {
      if (current) return current;
      if (src === IMAGE_FALLBACK_SRC) return current;
      return true;
    });
  }, [src]);

  return { displaySrc, unoptimized: shouldBypassImageOptimizer(displaySrc), markFailed };
}

export interface ImageSetFallback {
  /** `url`, or the placeholder if that url has already failed. */
  resolveSrc: (url: string) => string;
  /** Call from a given image's `onError`. */
  markFailed: (url: string) => void;
}

/**
 * Fallback state for a component showing many images at once (the listing
 * gallery: one main image plus a thumbnail strip plus a lightbox, all
 * potentially showing different URLs). Failures are tracked per URL so one
 * broken photo doesn't blank the rest.
 */
export function useImageSetFallback(): ImageSetFallback {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());

  const resolveSrc = useCallback((url: string) => resolveImageSrc(url, failedUrls.has(url)), [failedUrls]);

  const markFailed = useCallback((url: string) => {
    if (url === IMAGE_FALLBACK_SRC) return;
    setFailedUrls((previous) => (previous.has(url) ? previous : new Set(previous).add(url)));
  }, []);

  return { resolveSrc, markFailed };
}
