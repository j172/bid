"use client";

import type { ImgHTMLAttributes } from "react";
import { useImageFallback } from "@/lib/imageFallback";

type RetryableImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "onError" | "src"> & {
  src: string;
  alt: string;
};

/** Native image with one shared retry attempt before the site placeholder. */
export default function RetryableImage({ src, alt, ...props }: RetryableImageProps) {
  const { displaySrc, markFailed } = useImageFallback(src);

  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={displaySrc} alt={alt} onError={markFailed} />;
}
