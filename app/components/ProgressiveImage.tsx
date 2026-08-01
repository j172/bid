"use client";

import Image from "next/image";
import { useState } from "react";

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
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden="true" />}
      <Image
        src={src}
        alt={alt}
        fill
        priority={eager}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={fetchPriority}
        onLoad={() => setLoaded(true)}
        className={`${className} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}