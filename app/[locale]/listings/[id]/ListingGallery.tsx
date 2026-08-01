"use client";

import { useMemo, useState } from "react";

interface ListingGalleryProps {
  title: string;
  imageUrls: string[];
}

export default function ListingGallery({ title, imageUrls }: ListingGalleryProps) {
  const urls = useMemo(() => imageUrls.filter(Boolean), [imageUrls]);
  const [selectedUrl, setSelectedUrl] = useState(urls[0] ?? "");

  if (urls.length === 0) {
    return <div className="aspect-square rounded-xl border border-border bg-surface-muted" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square overflow-hidden rounded-xl border border-border bg-surface-muted shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selectedUrl} alt={title} className="h-full w-full object-cover" />
      </div>

      {urls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {urls.map((url) => {
            const active = url === selectedUrl;
            return (
              <button
                key={url}
                type="button"
                onClick={() => setSelectedUrl(url)}
                className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border bg-white ${
                  active ? "border-gold ring-2 ring-gold/30" : "border-border"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={title} className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
