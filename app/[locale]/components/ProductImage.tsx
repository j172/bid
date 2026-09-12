"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { IMAGE_FALLBACK_SRC, useImageFallback } from "@/lib/imageFallback";

// Static counterpart to ZoomableProductImage — same loading-skeleton /
// failed-image-fallback behaviour, but with none of the hover
// lens/preview-pane interaction (issue #251: the homepage's product
// thumbnails should no longer zoom on hover). See ZoomableProductImage.tsx
// for the /listings grid and listing-detail gallery, which keep the zoom.

// Safety net for the intermittent case where neither `onLoad` nor `onError`
// ever fires on the <Image> (observed in production; the file itself loads
// fine when accessed directly). Without this the image stays stuck at
// opacity-0 forever. If nothing has settled the load by this point, we treat
// it the same as an `onError` and fall back to the shared placeholder.
const LOAD_TIMEOUT_MS = 7000;

// Second, shorter safety net for the placeholder image itself: the same
// "no onLoad/onError ever fires" failure can also hit the fallback src once
// LOAD_TIMEOUT_MS has switched us over to it, in which case `loaded` would
// never flip and the card stays permanently blank (opacity-0) even though
// we've already given up and moved to the placeholder. Once displaySrc is
// the placeholder, force the image area visible if it still hasn't settled
// after this — no need to markFailed again, useImageFallback's markFailed is
// already a no-op once we're showing the placeholder.
const FALLBACK_SETTLE_TIMEOUT_MS = 3000;

interface ProductImageProps {
  src: string;
  alt: string;
  eager?: boolean;
  sizes?: string;
  fetchPriority?: "auto" | "high" | "low";
  className?: string;
}

export default function ProductImage({
  src,
  alt,
  eager = false,
  sizes = "(max-width: 768px) 100vw, 33vw",
  fetchPriority = "auto",
  className = "",
}: ProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const { displaySrc, unoptimized, markFailed } = useImageFallback(src);
  const settledRef = useRef(false);

  // The fallback half of this per-src reset lives in useImageFallback.
  useEffect(() => {
    setLoaded(false);
  }, [src]);

  // Watchdog for whichever request is currently in flight. Keyed on
  // `displaySrc`, not `src`: useImageFallback gives a failed image one
  // retry under a new URL (issue #171), which is a request the browser has
  // never attempted and so deserves this same "did anything ever happen"
  // protection, not just the one window starting at mount.
  useEffect(() => {
    settledRef.current = false;

    const timeoutId = window.setTimeout(() => {
      if (!settledRef.current) {
        settledRef.current = true;
        markFailed();
      }
    }, LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [displaySrc, markFailed]);

  // Runs whenever displaySrc becomes the placeholder (via the timeout above
  // or a normal onError) and `loaded` is still false. Re-arms itself if
  // `loaded` flips back to false for a new `src`, and is a no-op once the
  // placeholder has actually loaded.
  useEffect(() => {
    if (displaySrc !== IMAGE_FALLBACK_SRC || loaded) return;

    const timeoutId = window.setTimeout(() => {
      setLoaded(true);
    }, FALLBACK_SETTLE_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [displaySrc, loaded]);

  return (
    <div className="relative h-full w-full">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden="true" />}

      <Image
        src={displaySrc}
        alt={alt}
        fill
        unoptimized={unoptimized}
        priority={eager}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={fetchPriority}
        onLoad={() => {
          settledRef.current = true;
          setLoaded(true);
        }}
        onError={() => {
          settledRef.current = true;
          markFailed();
        }}
        className={`h-full w-full object-contain p-2 transition duration-300 ${eager || loaded ? "opacity-100" : "opacity-0"} ${className}`}
      />
    </div>
  );
}
