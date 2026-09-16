"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MODAL_TRIGGER_CLASS } from "../components/adminButtonClasses";
import AdminModal from "../components/AdminModal";
import ModalFormActions from "../components/ModalFormActions";
import DescriptionEditor, { type DescriptionEditorHandle } from "../listings/DescriptionEditor";
import ProductPhotoGalleryEditor, { type ProductPhotoItem } from "./ProductPhotoGalleryEditor";
import { PRODUCT_PRICE_TEXT_MAX, PRODUCT_TITLE_MAX } from "@/lib/productValidation";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";
const counterClass = (current: number, max: number) => `text-xs ${current > max ? "text-ended" : "text-ink-light"}`;

type EditProduct = {
  id: number;
  title: string;
  priceText: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  youtubeUrl: string | null;
  photos: { fileName: string; url: string; isCover: boolean }[];
};

type Props = { mode: "create" } | { mode: "edit"; product: EditProduct };

// Single modal component doubles as both "新增商品" and "編輯商品" — same
// create/edit collapse as PartnerLoftFormModal.tsx / FeaturedLoftFormModal.tsx
// (the interface pattern this ticket (#277) was asked to follow), extended
// with a multi-photo + cover-photo gallery editor in place of those two
// forms' single ImageUploadField.
export default function ProductFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const descriptionEditorRef = useRef<DescriptionEditorHandle>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.product.title : "");
  const [priceText, setPriceText] = useState(isEdit ? props.product.priceText : "");
  const [description, setDescription] = useState(isEdit ? props.product.description : "");
  const [sortOrder, setSortOrder] = useState(isEdit ? String(props.product.sortOrder) : "");
  const [isActive, setIsActive] = useState(isEdit ? props.product.isActive : true);
  const [youtubeUrl, setYoutubeUrl] = useState(isEdit ? (props.product.youtubeUrl ?? "") : "");
  const [photoItems, setPhotoItems] = useState<ProductPhotoItem[]>(
    isEdit
      ? props.product.photos.map((photo) => ({
          kind: "existing" as const,
          fileName: photo.fileName,
          url: photo.url,
          isCover: photo.isCover,
        }))
      : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle(isEdit ? props.product.title : "");
    setPriceText(isEdit ? props.product.priceText : "");
    setDescription(isEdit ? props.product.description : "");
    setSortOrder(isEdit ? String(props.product.sortOrder) : "");
    setIsActive(isEdit ? props.product.isActive : true);
    setYoutubeUrl(isEdit ? (props.product.youtubeUrl ?? "") : "");
    setPhotoItems(
      isEdit
        ? props.product.photos.map((photo) => ({
            kind: "existing" as const,
            fileName: photo.fileName,
            url: photo.url,
            isCover: photo.isCover,
          }))
        : [],
    );
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (photoItems.length === 0) {
      setError("請至少上傳一張照片");
      return;
    }

    setSubmitting(true);

    const { html: descriptionHtml } = descriptionEditorRef.current!.extractForSubmit();

    let newIndex = 0;
    const order = photoItems.map((item) =>
      item.kind === "existing"
        ? { type: "existing" as const, fileName: item.fileName, isCover: item.isCover }
        : { type: "new" as const, index: newIndex++, isCover: item.isCover },
    );

    const formData = new FormData();
    formData.set("title", title);
    formData.set("priceText", priceText);
    formData.set("description", descriptionHtml);
    if (sortOrder.trim() !== "") formData.set("sortOrder", sortOrder.trim());
    formData.set("isActive", isActive ? "true" : "false");
    formData.set("youtubeUrl", youtubeUrl.trim());
    formData.set("order", JSON.stringify(order));
    for (const item of photoItems) {
      if (item.kind === "new") formData.append("photos", item.file);
    }

    let response: Response;
    if (isEdit) {
      response = await fetch(`/api/admin/products/${props.product.id}`, { method: "PATCH", body: formData });
    } else {
      response = await fetch("/api/admin/products", { method: "POST", body: formData });
    }
    const data = await response.json().catch(() => ({ ok: false, error: "儲存失敗" }));

    setSubmitting(false);
    if (!data.ok) {
      setError(data.error ?? "儲存失敗");
      return;
    }
    setOpen(false);
    if (!isEdit) resetForm();
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={MODAL_TRIGGER_CLASS(isEdit)}>
        {isEdit ? "編輯" : "＋ 新增商品"}
      </button>

      {open && (
        <AdminModal title={isEdit ? "編輯商品" : "新增商品"} size="xl">
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              標題
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={PRODUCT_TITLE_MAX} required className={inputClass} />
              <span className={counterClass(title.length, PRODUCT_TITLE_MAX)}>
                {title.length}/{PRODUCT_TITLE_MAX}
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              價格顯示文字（純文字，例如「NT$12,000」或「電洽」，不做金額運算）
              <input
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                maxLength={PRODUCT_PRICE_TEXT_MAX}
                placeholder="NT$12,000"
                required
                className={inputClass}
              />
            </label>

            <ProductPhotoGalleryEditor items={photoItems} onChange={setPhotoItems} />

            <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              商品簡介
              <DescriptionEditor ref={descriptionEditorRef} value={description} onChange={setDescription} enableImages={false} />
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              精選 YouTube 影片連結（選填，於商品詳情頁單獨播放，與簡介內插入的影片無關）
              <input
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              排序（留空自動排在最後）
              <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} step={1} className={inputClass} />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              啟用中（於首頁輪播與詳情頁顯示）
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
        </AdminModal>
      )}
    </>
  );
}
