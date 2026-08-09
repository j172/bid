"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useImageFallback } from "@/lib/imageFallback";

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  sizes?: string;
  fetchPriority?: "auto" | "high" | "low";
}

export default function ProgressiveImage({
  src,
  alt,
  className = "",
  eager = false,
  sizes = "(max-width: 768px) 100vw, 33vw",
  fetchPriority = "auto",
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(eager);
  const { displaySrc, unoptimized, markFailed } = useImageFallback(src);

  // A carousel (HeroSection) reuses this component instance across slides,
  // so the fade-in must restart per slide. The fallback half of that reset
  // lives in useImageFallback.
  useEffect(() => {
    setLoaded(eager);
  }, [src, eager]);

  return (
    <div className="relative h-full w-full overflow-hidden">
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
        onLoad={() => setLoaded(true)}
        onError={markFailed}
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
