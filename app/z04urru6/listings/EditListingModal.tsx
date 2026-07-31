"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { convertPhotoToWebp } from "@/lib/convertPhotoToWebp";
import { DESCRIPTION_MAX, PRICE_MAX, TITLE_MAX } from "@/lib/listingValidation";
import { MAX_PHOTO_BYTES, MAX_PHOTO_COUNT } from "@/lib/photoLimits";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none";
const counterClass = (current: number, max: number) => `text-xs ${current > max ? "text-ended" : "text-ink-light"}`;

type PhotoItem =
  | { kind: "existing"; fileName: string; url: string }
  | { kind: "new"; file: File; previewUrl: string };

export default function EditListingModal({ listingId }: { listingId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stockRemaining, setStockRemaining] = useState("");
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Revoke object URLs created for newly-added photos when they're replaced/removed/unmounted.
  useEffect(() => {
    return () => {
      for (const item of photoItems) {
        if (item.kind === "new") URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [photoItems]);

  async function handleOpen() {
    setOpen(true);
    if (loaded) return;

    setLoading(true);
    setLoadError(null);
    const response = await fetch(`/api/admin/listings/${listingId}`);
    const data = await response.json();
    setLoading(false);
    if (!data.ok) {
      setLoadError(data.error ?? "讀取失敗");
      return;
    }
    setTitle(data.listing.title);
    setDescription(data.listing.description);
    setPrice(String(data.listing.price));
    setStockRemaining(String(data.listing.stockRemaining));
    setPhotoItems(
      data.listing.photos.map((photo: { fileName: string; url: string }) => ({
        kind: "existing" as const,
        fileName: photo.fileName,
        url: photo.url,
      })),
    );
    setLoaded(true);
  }

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";

    setPhotoError(null);
    // Converted client-side (see convertPhotoToWebp's comment for why) before
    // the size check, so the 5MB limit applies to what actually gets uploaded.
    const converted = await Promise.all(selected.map((file) => convertPhotoToWebp(file)));

    const oversized = converted.find((file) => file.size > MAX_PHOTO_BYTES);
    if (oversized) {
      setPhotoError(`「${oversized.name}」超過單檔 ${MAX_PHOTO_BYTES / 1024 / 1024}MB 上限`);
      return;
    }
    setPhotoItems((current) => {
      const combined: PhotoItem[] = [
        ...current,
        ...converted.map((file) => ({ kind: "new" as const, file, previewUrl: URL.createObjectURL(file) })),
      ];
      if (combined.length > MAX_PHOTO_COUNT) {
        setPhotoError(`照片最多 ${MAX_PHOTO_COUNT} 張`);
        return current;
      }
      return combined;
    });
  }

  function removePhoto(index: number) {
    setPhotoError(null);
    setPhotoItems((current) => current.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex: number) {
    setPhotoItems((current) => {
      if (dragIndex === null || dragIndex === targetIndex) return current;
      const next = [...current];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    let newIndex = 0;
    const order = photoItems.map((item) =>
      item.kind === "existing" ? { type: "existing", fileName: item.fileName } : { type: "new", index: newIndex++ },
    );

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("price", price);
    formData.set("stockRemaining", stockRemaining);
    formData.set("order", JSON.stringify(order));
    for (const item of photoItems) {
      if (item.kind === "new") formData.append("photos", item.file);
    }

    const response = await fetch(`/api/admin/listings/${listingId}/edit`, { method: "POST", body: formData });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "更新失敗");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
      >
        編輯
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold">編輯商品</h2>

            {loading && <p className="mt-4 text-sm text-ink-light">載入中...</p>}
            {loadError && <p className="mt-4 text-sm text-ended">{loadError}</p>}

            {loaded && (
              <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  標題
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={TITLE_MAX}
                    required
                    className={inputClass}
                  />
                  <span className={counterClass(title.length, TITLE_MAX)}>
                    {title.length}/{TITLE_MAX}
                  </span>
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  描述
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={DESCRIPTION_MAX}
                    required
                    rows={4}
                    className={inputClass}
                  />
                  <span className={counterClass(description.length, DESCRIPTION_MAX)}>
                    {description.length}/{DESCRIPTION_MAX}
                  </span>
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  價格
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    type="number"
                    min={1}
                    max={PRICE_MAX}
                    step={1}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                  剩餘庫存
                  <input
                    value={stockRemaining}
                    onChange={(e) => setStockRemaining(e.target.value)}
                    type="number"
                    min={0}
                    step={1}
                    required
                    className={inputClass}
                  />
                </label>

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
                  {photoItems.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {photoItems.map((item, index) => (
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

                {error && <p className="text-sm text-ended">{error}</p>}
                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || photoItems.length === 0}
                    className="rounded-md bg-header px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "儲存中..." : "儲存"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
