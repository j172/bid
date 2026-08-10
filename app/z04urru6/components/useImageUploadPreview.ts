"use client";

import { useRef, useState, type ChangeEvent } from "react";

/**
 * 「選檔案 → 立刻顯示預覽 → 取消時還原」的共用邏輯，最新訊息、入賞鴿／進口鴿
 * 與合作鴿舍三個表單 modal 共用（issue #139 M4）。
 *
 * 預覽用的 blob: URL 一律在被換掉或重置時 revoke，避免累積洩漏。
 */
export function useImageUploadPreview(initialUrl: string | null) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  /** 回到剛打開表單時的狀態：預覽換回原圖、清掉已選的檔案。 */
  function reset() {
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return initialUrl;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** 目前選到的檔案；沒選則為 undefined（編輯模式代表「不更換圖片」）。 */
  function selectedFile(): File | undefined {
    return fileInputRef.current?.files?.[0];
  }

  return { fileInputRef, previewUrl, handleFileChange, reset, selectedFile };
}
