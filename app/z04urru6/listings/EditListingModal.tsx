"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DescriptionEditor, { type DescriptionEditorHandle } from "./DescriptionEditor";
import PhotoGalleryEditor, { type PhotoItem } from "./PhotoGalleryEditor";
import { usePartnerLofts } from "./usePartnerLofts";
import { SECONDARY_TRIGGER_CLASS } from "../components/adminButtonClasses";
import AdminModal from "../components/AdminModal";
import ModalFormActions from "../components/ModalFormActions";
import { PRICE_MAX, TITLE_MAX } from "@/lib/listingValidation";

const inputClass = "w-full rounded-md border border-border px-3 py-2 focus:border-interactive-primary focus:outline-none";
const counterClass = (current: number, max: number) => `text-xs ${current > max ? "text-ended" : "text-ink-light"}`;

export default function EditListingModal({ listingId }: { listingId: number }) {
  const router = useRouter();
  const descriptionEditorRef = useRef<DescriptionEditorHandle>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stockRemaining, setStockRemaining] = useState("");
  const [loftId, setLoftId] = useState("");
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lofts = usePartnerLofts();

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
    setLoftId(data.listing.loftId ? String(data.listing.loftId) : "");
    setPhotoItems(
      data.listing.photos.map((photo: { fileName: string; url: string }) => ({
        kind: "existing" as const,
        fileName: photo.fileName,
        url: photo.url,
      })),
    );
    setLoaded(true);
  }

  // 取消後把 loaded 一起清掉，下次打開才會重新抓伺服器上的真實資料，
  // 而不是顯示上一次沒送出的編輯內容（issue #139 M2）。
  function resetForm() {
    setLoaded(false);
    setLoadError(null);
    setError(null);
    setTitle("");
    setDescription("");
    setPrice("");
    setStockRemaining("");
    setLoftId("");
    setPhotoItems([]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { html: descriptionHtml, images: descriptionImages } = descriptionEditorRef.current!.extractForSubmit();

    let newIndex = 0;
    const order = photoItems.map((item) =>
      item.kind === "existing" ? { type: "existing", fileName: item.fileName } : { type: "new", index: newIndex++ },
    );

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", descriptionHtml);
    formData.set("price", price);
    formData.set("stockRemaining", stockRemaining);
    formData.set("loftId", loftId);
    formData.set("order", JSON.stringify(order));
    for (const item of photoItems) {
      if (item.kind === "new") formData.append("photos", item.file);
    }
    for (const image of descriptionImages) {
      formData.append("descriptionImages", image);
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
        className={SECONDARY_TRIGGER_CLASS}
      >
        編輯
      </button>

      {open && (
        <AdminModal title="編輯商品" size="lg">
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

              <PhotoGalleryEditor items={photoItems} onChange={setPhotoItems} />

              <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                描述
                <DescriptionEditor ref={descriptionEditorRef} value={description} onChange={setDescription} />
              </div>

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

              {error && <p className="text-sm text-ended">{error}</p>}
              <ModalFormActions
                onCancel={() => {
                  setOpen(false);
                  resetForm();
                }}
                submitting={submitting}
                submitLabel="儲存"
                pendingLabel="儲存中..."
                submitDisabled={photoItems.length === 0}
              />
            </form>
          )}
        </AdminModal>
      )}
    </>
  );
}
