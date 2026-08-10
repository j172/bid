"use client";

import type { ChangeEvent, ReactNode, RefObject } from "react";

/** 搭配 useImageUploadPreview 使用的檔案選擇欄位 + 縮圖預覽。 */
export default function ImageUploadField({
  label,
  fileInputRef,
  previewUrl,
  onChange,
}: {
  label: ReactNode;
  fileInputRef: RefObject<HTMLInputElement | null>;
  previewUrl: string | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
      {label}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onChange}
        className="text-sm"
      />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="mt-2 h-24 w-24 rounded-md border border-border object-cover" />
      )}
    </div>
  );
}
