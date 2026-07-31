"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../components/Button";
import { convertPhotoToWebp } from "@/lib/convertPhotoToWebp";
import { DESCRIPTION_MAX, ENDS_AT_MAX_DAYS, PRICE_MAX, TITLE_MAX } from "@/lib/listingValidation";
import { MAX_PHOTO_BYTES, MAX_PHOTO_COUNT } from "@/lib/photoLimits";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-gold focus:outline-none";
const counterClass = (current: number, max: number) => `text-xs ${current > max ? "text-ended" : "text-ink-light"}`;

type ListingType = "auction" | "fixed_price";

export default function NewListingForm() {
  const router = useRouter();
  const [listingType, setListingType] = useState<ListingType>("auction");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [buyItNowPrice, setBuyItNowPrice] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Object URLs for the thumbnail previews — created fresh whenever the
  // photos array changes, and revoked on cleanup so selecting/removing many
  // photos across a long editing session doesn't leak memory.
  const photoPreviews = useMemo(() => photos.map((photo) => URL.createObjectURL(photo)), [photos]);
  useEffect(() => {
    return () => {
      for (const url of photoPreviews) URL.revokeObjectURL(url);
    };
  }, [photoPreviews]);

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
    setPhotos((current) => {
      const combined = [...current, ...converted];
      if (combined.length > MAX_PHOTO_COUNT) {
        setPhotoError(`照片最多 ${MAX_PHOTO_COUNT} 張`);
        return current;
      }
      return combined;
    });
  }

  function removePhoto(index: number) {
    setPhotoError(null);
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex: number) {
    setPhotos((current) => {
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

    const formData = new FormData();
    formData.set("listingType", listingType);
    formData.set("title", title);
    formData.set("description", description);
    if (listingType === "fixed_price") {
      formData.set("price", price);
      formData.set("stockQuantity", stockQuantity);
    } else {
      formData.set("startingPrice", startingPrice);
      formData.set("buyItNowPrice", buyItNowPrice);
      formData.set("endsAt", endsAt);
    }
    for (const photo of photos) {
      formData.append("photos", photo);
    }

    const response = await fetch("/api/admin/listings", { method: "POST", body: formData });
    const data = await response.json();

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "建立失敗");
      return;
    }
    router.push(`/listings/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        商品類型
        <div className="flex gap-4 text-ink">
          <label className="flex items-center gap-2 font-normal">
            <input
              type="radio"
              name="listingType"
              checked={listingType === "auction"}
              onChange={() => setListingType("auction")}
            />
            競標商品
          </label>
          <label className="flex items-center gap-2 font-normal">
            <input
              type="radio"
              name="listingType"
              checked={listingType === "fixed_price"}
              onChange={() => setListingType("fixed_price")}
            />
            一般商品（不開放競標，僅一鍵買斷）
          </label>
        </div>
      </fieldset>

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
          rows={5}
          className={inputClass}
        />
        <span className={counterClass(description.length, DESCRIPTION_MAX)}>
          {description.length}/{DESCRIPTION_MAX}
        </span>
      </label>

      {listingType === "fixed_price" ? (
        <>
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
            庫存數量
            <input
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              type="number"
              min={1}
              step={1}
              required
              className={inputClass}
            />
          </label>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            起標價
            <input
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value)}
              type="number"
              min={1}
              max={PRICE_MAX}
              step={1}
              required
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            買斷價（選填，若填寫必須大於起標價；留空則此商品不提供一鍵買斷）
            <input
              value={buyItNowPrice}
              onChange={(e) => setBuyItNowPrice(e.target.value)}
              type="number"
              min={1}
              max={PRICE_MAX}
              step={1}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
            結標時間（最遠 {ENDS_AT_MAX_DAYS} 天後）
            <input
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              type="datetime-local"
              required
              className={inputClass}
            />
          </label>
        </>
      )}

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
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {photos.map((photo, index) => (
              <div
                key={`${photo.name}-${photo.lastModified}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(index)}
                className="relative h-24 w-24 cursor-move overflow-hidden rounded-md border border-border"
                title="拖曳可調整順序"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreviews[index]} alt="" className="h-full w-full object-cover" />
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
      <Button type="submit" disabled={submitting || photos.length === 0}>
        {submitting ? "建立中..." : "建立商品"}
      </Button>
    </form>
  );
}
