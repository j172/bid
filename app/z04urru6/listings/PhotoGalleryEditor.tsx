"use client";

import { useEffect, useRef, useState } from "react";
import { convertPhotoToWebp } from "@/lib/convertPhotoToWebp";
import { MAX_PHOTO_BYTES, MAX_PHOTO_COUNT } from "@/lib/photoLimits";

export type PhotoItem =
  | { kind: "existing"; fileName: string; url: string }
  | { kind: "new"; file: File; previewUrl: string };

interface PhotoGalleryEditorProps {
  items: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
}

export default function PhotoGalleryEditor({ items, onChange }: PhotoGalleryEditorProps) {
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Revoke preview object URLs for "new" photos on unmount (e.g. the edit
  // modal closed, or navigation away from the new-listing page, without
  // submitting) — kept in a ref so this only ever runs once, on unmount.
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
    // Converted client-side (see convertPhotoToWebp's comment for why) before
    // the size check, so the 5MB limit applies to what actually gets uploaded.
    const converted = await Promise.all(selected.map((file) => convertPhotoToWebp(file)));

    const oversized = converted.find((file) => file.size > MAX_PHOTO_BYTES);
    if (oversized) {
      setPhotoError(`「${oversized.name}」超過單檔 ${MAX_PHOTO_BYTES / 1024 / 1024}MB 上限`);
      return;
    }
    const combined: PhotoItem[] = [
      ...items,
      ...converted.map((file) => ({ kind: "new" as const, file, previewUrl: URL.createObjectURL(file) })),
    ];
    if (combined.length > MAX_PHOTO_COUNT) {
      setPhotoError(`照片最多 ${MAX_PHOTO_COUNT} 張`);
      return;
    }
    onChange(combined);
  }

  function removePhoto(index: number) {
    setPhotoError(null);
    const removed = items[index];
    if (removed.kind === "new") URL.revokeObjectURL(removed.previewUrl);
    onChange(items.filter((_, i) => i !== index));
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
      商品照片（至少一張，最多 {MAX_PHOTO_COUNT} 張，單檔上限 {MAX_PHOTO_BYTES / 1024 / 1024}MB）
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
              className="relative h-24 w-24 cursor-move overflow-hidden rounded-md border border-border"
              title="拖曳可調整順序"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.kind === "existing" ? item.url : item.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              {index === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 text-center text-[10px] text-white">
                  主圖
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
          ))}
        </div>
      )}
    </div>
  );
}
