"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "../../../components/Button";
import DescriptionEditor, { type DescriptionEditorHandle } from "../DescriptionEditor";
import PhotoGalleryEditor, { type PhotoItem } from "../PhotoGalleryEditor";
import { usePartnerLofts } from "../usePartnerLofts";
import { ENDS_AT_MAX_DAYS, PRICE_MAX, TITLE_MAX } from "@/lib/listingValidation";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";
const counterClass = (current: number, max: number) => `text-xs ${current > max ? "text-ended" : "text-ink-light"}`;

type ListingType = "auction" | "fixed_price";

export default function NewListingForm() {
  const router = useRouter();
  const descriptionEditorRef = useRef<DescriptionEditorHandle>(null);
  const [listingType, setListingType] = useState<ListingType>("auction");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [buyItNowPrice, setBuyItNowPrice] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [loftId, setLoftId] = useState("");
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lofts = usePartnerLofts();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { html: descriptionHtml, images: descriptionImages } = descriptionEditorRef.current!.extractForSubmit();

    const formData = new FormData();
    formData.set("listingType", listingType);
    formData.set("title", title);
    formData.set("description", descriptionHtml);
    if (listingType === "fixed_price") {
      formData.set("price", price);
      formData.set("stockQuantity", stockQuantity);
    } else {
      formData.set("startingPrice", startingPrice);
      formData.set("buyItNowPrice", buyItNowPrice);
      formData.set("startsAt", startsAt);
      formData.set("endsAt", endsAt);
    }
    if (loftId) formData.set("loftId", loftId);
    for (const item of photoItems) {
      if (item.kind === "new") formData.append("photos", item.file);
    }
    for (const image of descriptionImages) {
      formData.append("descriptionImages", image);
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
        合作鴿舍（選填）
        <select value={loftId} onChange={(e) => setLoftId(e.target.value)} className={inputClass}>
          <option value="">無</option>
          {lofts.map((loft) => (
            <option key={loft.id} value={loft.id}>
              {loft.title}
            </option>
          ))}
        </select>
      </label>

      <PhotoGalleryEditor items={photoItems} onChange={setPhotoItems} />

      <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        描述
        <DescriptionEditor ref={descriptionEditorRef} value={description} onChange={setDescription} />
      </div>

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
            起標時間（選填，最遠 {ENDS_AT_MAX_DAYS} 天後；留空則立即開放競標）
            <input
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              type="datetime-local"
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

      {error && <p className="text-sm text-ended">{error}</p>}
      <Button type="submit" disabled={submitting || photoItems.length === 0}>
        {submitting ? "建立中..." : "建立商品"}
      </Button>
    </form>
  );
}
