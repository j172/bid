"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const FALLBACK_SRC = "/images/hero-placeholder.png";

interface ZoomableProductImageProps {
  src: string;
  alt: string;
  eager?: boolean;
  sizes?: string;
  fetchPriority?: "auto" | "high" | "low";
  className?: string;
  zoomPreset?: "low" | "medium" | "high";
}

type CursorState = {
  x: number;
  y: number;
  pctX: number;
  pctY: number;
  width: number;
  height: number;
};

type PanePosition = {
  left: number;
  top: number;
};

const LENS_SIZE = 120;
const PREVIEW_SIZE = 288;
const PREVIEW_GAP = 14;
const VIEWPORT_EDGE_PADDING = 16;
const HOVER_SHOW_DELAY_MS = 100;

const ZOOM_PRESET_SCALE: Record<"low" | "medium" | "high", number> = {
  low: 2.0,
  medium: 2.4,
  high: 2.8,
};

export default function ZoomableProductImage({
  src,
  alt,
  eager = false,
  sizes = "(max-width: 768px) 100vw, 33vw",
  fetchPriority = "auto",
  className = "",
  zoomPreset = "medium",
}: ZoomableProductImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [hoverVisible, setHoverVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lowPerformanceMode, setLowPerformanceMode] = useState(false);
  const [cursor, setCursor] = useState<CursorState>({
    x: 50,
    y: 50,
    pctX: 50,
    pctY: 50,
    width: 100,
    height: 100,
  });
  const [panePosition, setPanePosition] = useState<PanePosition>({ left: VIEWPORT_EDGE_PADDING, top: VIEWPORT_EDGE_PADDING });

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
    setHovering(false);
    setHoverVisible(false);
    setCursor({ x: 50, y: 50, pctX: 50, pctY: 50, width: 100, height: 100 });
    setPanePosition({ left: VIEWPORT_EDGE_PADDING, top: VIEWPORT_EDGE_PADDING });
  }, [src]);

  useEffect(() => {
    if (!hovering) {
      setHoverVisible(false);
      return;
    }

    const timerId = window.setTimeout(() => {
      setHoverVisible(true);
    }, HOVER_SHOW_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [hovering]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateReducedMotion = () => setReducedMotion(media.matches);
    updateReducedMotion();

    const cores = navigator.hardwareConcurrency ?? 8;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    setLowPerformanceMode(cores <= 4 || memory <= 4);

    media.addEventListener("change", updateReducedMotion);
    return () => media.removeEventListener("change", updateReducedMotion);
  }, []);

  const displaySrc = errored ? FALLBACK_SRC : src;
  const shouldBypassOptimizer = displaySrc.startsWith("/uploads/") || displaySrc.includes("/uploads/");
  const interactionsEnabled = !reducedMotion && !lowPerformanceMode;
  const zoomScale = ZOOM_PRESET_SCALE[zoomPreset];
  const lensLeft = Math.min(Math.max(cursor.x - LENS_SIZE / 2, 0), Math.max(cursor.width - LENS_SIZE, 0));
  const lensTop = Math.min(Math.max(cursor.y - LENS_SIZE / 2, 0), Math.max(cursor.height - LENS_SIZE, 0));

  function updatePanePosition(rect: DOMRect, yInRect: number) {
    const rightSpace = window.innerWidth - rect.right;
    const leftSpace = rect.left;
    const neededSpace = PREVIEW_SIZE + PREVIEW_GAP + VIEWPORT_EDGE_PADDING;
    const canPlaceRight = rightSpace >= neededSpace;
    const canPlaceLeft = leftSpace >= neededSpace;

    let targetLeft =
      canPlaceRight || (!canPlaceLeft && rightSpace >= leftSpace)
        ? rect.right + PREVIEW_GAP
        : rect.left - PREVIEW_GAP - PREVIEW_SIZE;

    const minLeft = VIEWPORT_EDGE_PADDING;
    const maxLeft = Math.max(window.innerWidth - PREVIEW_SIZE - VIEWPORT_EDGE_PADDING, minLeft);
    targetLeft = Math.min(Math.max(targetLeft, minLeft), maxLeft);

    const unclampedTop = rect.top + yInRect - PREVIEW_SIZE / 2;
    const minTop = VIEWPORT_EDGE_PADDING;
    const maxTop = Math.max(window.innerHeight - PREVIEW_SIZE - VIEWPORT_EDGE_PADDING, minTop);
    const targetTop = Math.min(Math.max(unclampedTop, minTop), maxTop);

    setPanePosition({ left: targetLeft, top: targetTop });
  }

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={(event) => {
        if (!interactionsEnabled) return;
        setHovering(true);
        const rect = event.currentTarget.getBoundingClientRect();
        updatePanePosition(rect, cursor.y);
      }}
      onMouseLeave={() => {
        if (!interactionsEnabled) return;
        setHovering(false);
      }}
      onMouseMove={(event) => {
        if (!interactionsEnabled) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const rawX = event.clientX - rect.left;
        const rawY = event.clientY - rect.top;
        const x = Math.min(Math.max(rawX, 0), rect.width);
        const y = Math.min(Math.max(rawY, 0), rect.height);
        const pctX = rect.width > 0 ? (x / rect.width) * 100 : 50;
        const pctY = rect.height > 0 ? (y / rect.height) * 100 : 50;
        setCursor({ x, y, pctX, pctY, width: rect.width, height: rect.height });
        updatePanePosition(rect, y);
      }}
    >
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
        className={`h-full w-full object-contain p-2 transition duration-300 ${interactionsEnabled && hoverVisible ? "scale-[1.06]" : "scale-100"} ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
        style={{ transformOrigin: `${cursor.pctX}% ${cursor.pctY}%` }}
      />

      <div
        className={`pointer-events-none absolute hidden h-[120px] w-[120px] rounded-lg border border-white/70 bg-white/20 shadow-[0_8px_24px_rgba(15,23,42,0.18)] backdrop-blur-[1px] transition duration-200 lg:block ${interactionsEnabled && hoverVisible ? "opacity-100" : "opacity-0"}`}
        style={{
          left: `${lensLeft}px`,
          top: `${lensTop}px`,
        }}
        aria-hidden="true"
      />

      <div
        className={`pointer-events-none fixed z-[70] hidden aspect-square w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.28)] transition duration-200 lg:block ${interactionsEnabled && hoverVisible ? "opacity-100" : "opacity-0"}`}
        style={{ left: `${panePosition.left}px`, top: `${panePosition.top}px` }}
        aria-hidden="true"
      >
        <Image
          src={displaySrc}
          alt=""
          fill
          unoptimized={shouldBypassOptimizer}
          sizes="288px"
          loading="lazy"
          className="object-contain p-3"
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: `${cursor.pctX}% ${cursor.pctY}%`,
          }}
        />
      </div>
    </div>
  );
}
