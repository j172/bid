"use client";

import Image from "next/image";
import { useImageFallback } from "@/lib/imageFallback";

// Homepage partner-loft card image (issue #155 item 3) — the card itself is
// a Server Component, but useImageFallback is a client hook, so just this
// <Image> is split out. Same "bypass Next's optimizer for /uploads/ paths,
// fall back to the shared placeholder on error" pattern as
// ZoomableProductImage.tsx; this is an extra defensive layer on top of #152
// (which fixed the OOM root cause), not a replacement for it.
interface PartnerLoftImageProps {
  src: string;
  alt: string;
  sizes: string;
}

export default function PartnerLoftImage({ src, alt, sizes }: PartnerLoftImageProps) {
  const { displaySrc, unoptimized, markFailed } = useImageFallback(src);

  return (
    <Image
      src={displaySrc}
      alt={alt}
      fill
      unoptimized={unoptimized}
      sizes={sizes}
      className="object-cover transition group-hover:scale-105"
      onError={markFailed}
    />
  );
}
