"use client";

import { useEffect, useRef, useState } from "react";
import { convertPhotoToWebp } from "@/lib/convertPhotoToWebp";
import { MAX_PHOTO_BYTES, MAX_PHOTO_COUNT } from "@/lib/photoLimits";

// Own copy of ../listings/PhotoGalleryEditor.tsx's item shape plus one
// addition: `isCover`, tracked directly on each item rather than inferred
// from list position (unlike listing_photos, product_photos has an explicit
// is_cover column — see db/init.sql's comment on why: admins need to
// *designate* a cover photo, not just drag one to the front). Kept as its
// own component rather than adding an optional cover-picker prop to the
// shared listings editor — listings have no cover concept at all, and this
// ticket (#277) is scoped to products only.
export type ProductPhotoItem =
  | { kind: "existing"; fileName: string; url: string; isCover: boolean }
  | { kind: "new"; file: File; previewUrl: string; isCover: boolean };

interface ProductPhotoGalleryEditorProps {
  items: ProductPhotoItem[];
  onChange: (items: ProductPhotoItem[]) => void;
}

/** Reassigns isCover so exactly one item (the one at `coverIndex`) is true. */
function withCover<T extends { isCover: boolean }>(items: T[], coverIndex: number): T[] {
  return items.map((item, index) => ({ ...item, isCover: index === coverIndex }));
}

export default function ProductPhotoGalleryEditor({ items, onChange }: ProductPhotoGalleryEditorProps) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Revoke preview object URLs for "new" photos on unmount — same reasoning
  // as PhotoGalleryEditor.tsx.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        if (item.kind === "new") URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = ""; // allow re-selecting the same file after removing it

    setPhotoError(null);
    const converted = await Promise.all(selected.map((file) => convertPhotoToWebp(file)));

    const oversized = converted.find((file) => file.size > MAX_PHOTO_BYTES);
    if (oversized) {
      setPhotoError(`「${oversized.name}」超過單檔 ${MAX_PHOTO_BYTES / 1024 / 1024}MB 上限`);
      return;
    }
    const hadNoPhotosBefore = items.length === 0;
    const combined: ProductPhotoItem[] = [
      ...items,
      ...converted.map((file) => ({
        kind: "new" as const,
        file,
        previewUrl: URL.createObjectURL(file),
        isCover: false,
      })),
    ];
    if (combined.length > MAX_PHOTO_COUNT) {
      setPhotoError(`照片最多 ${MAX_PHOTO_COUNT} 張`);
      return;
    }
    // The gallery always keeps exactly one cover photo selected — the very
    // first upload (into an empty gallery) is auto-designated so admins
    // aren't required to remember a separate step.
    onChange(hadNoPhotosBefore ? withCover(combined, 0) : combined);
  }

  function removePhoto(index: number) {
    setPhotoError(null);
    const removed = items[index];
    if (removed.kind === "new") URL.revokeObjectURL(removed.previewUrl);
    const next = items.filter((_, i) => i !== index);
    // Removing the current cover photo promotes whatever is now first, so
    // there's never a moment with zero (or more than one) cover selected.
    onChange(removed.isCover && next.length > 0 ? withCover(next, 0) : next);
  }

  function setCover(index: number) {
    onChange(withCover(items, index));
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-ink-light">
      商品照片（至少一張，最多 {MAX_PHOTO_COUNT} 張，單檔上限 {MAX_PHOTO_BYTES / 1024 / 1024}MB；點選「設為封面」指定首頁輪播卡使用的照片）
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleFilesSelected}
        className="w-full text-sm"
      />
      {photoError && <p className="text-sm text-ended">{photoError}</p>}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {items.map((item, index) => (
            <div
              key={item.kind === "existing" ? item.fileName : `${item.file.name}-${item.file.lastModified}-${index}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className="relative flex h-28 w-24 cursor-move flex-col overflow-hidden rounded-md border border-border"
              title="拖曳可調整順序"
            >
              <div className="relative h-24 w-24 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.kind === "existing" ? item.url : item.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {item.isCover && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 text-center text-[10px] text-white">
                    封面
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label="移除這張照片"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-black/80"
                >
                  ×
                </button>
              </div>
              {!item.isCover && (
                <button
                  type="button"
                  onClick={() => setCover(index)}
                  className="w-full bg-surface-muted px-1 py-0.5 text-[10px] font-medium text-ink-light hover:bg-border"
                >
                  設為封面
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
