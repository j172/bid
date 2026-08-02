"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const FALLBACK_SRC = "/images/hero-placeholder.png";

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
  const [errored, setErrored] = useState(false);

  // A carousel (HeroSection) reuses this component instance across slides,
  // so a failure on one image must not permanently fall back every slide after it.
  useEffect(() => {
    setLoaded(eager);
    setErrored(false);
  }, [src, eager]);

  const displaySrc = errored ? FALLBACK_SRC : src;
  const shouldBypassOptimizer = displaySrc.startsWith("/uploads/") || displaySrc.includes("/uploads/");

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden="true" />}
      <Image
        src={displaySrc}
        alt={alt}
        fill
        unoptimized={shouldBypassOptimizer}
        priority={eager}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={fetchPriority}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (displaySrc === FALLBACK_SRC) return;
          setErrored(true);
        }}
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}