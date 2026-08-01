"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ListingGalleryProps {
  title: string;
  imageUrls: string[];
}

export default function ListingGallery({ title, imageUrls }: ListingGalleryProps) {
  const urls = useMemo(() => imageUrls.filter(Boolean), [imageUrls]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedUrl = urls[selectedIndex] ?? "";
  const galleryRef = useRef<HTMLDivElement>(null);

  const moveSelection = useCallback(
    (direction: 1 | -1) => {
      if (urls.length <= 1) return;
      setSelectedIndex((previous) => {
        const next = previous + direction;
        if (next < 0) return urls.length - 1;
        if (next >= urls.length) return 0;
        return next;
      });
    },
    [urls.length],
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [urls.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!galleryRef.current?.contains(document.activeElement)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveSelection(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveSelection(1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveSelection]);

  if (urls.length === 0) {
    return <div className="aspect-video rounded-xl border border-border bg-surface-muted" />;
  }

  return (
    <div className="flex flex-col gap-4" ref={galleryRef}>
      <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-surface-muted shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selectedUrl} alt={title} className="h-full w-full object-cover" />
      </div>

      {urls.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {urls.map((url, index) => {
            const active = index === selectedIndex;
            return (
              <button
                key={url}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`${title} image ${index + 1}`}
                aria-pressed={active}
                className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border bg-white transition ${
                  active
                    ? "border-brand-blue ring-2 ring-brand-blue/30"
                    : "border-border hover:border-brand-blue/50 focus-visible:border-brand-blue"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={title} className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}

      {urls.length > 1 && (
        <p className="text-xs text-ink-light">Use ← / → to switch photos</p>
      )}
    </div>
  );
}
