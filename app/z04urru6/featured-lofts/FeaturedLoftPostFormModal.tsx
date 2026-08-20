"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTENT_MAX, TITLE_MAX } from "@/lib/featuredLoftPostValidation";
import { MODAL_TRIGGER_CLASS } from "../components/adminButtonClasses";
import AdminModal from "../components/AdminModal";
import ImageUploadField from "../components/ImageUploadField";
import ModalFormActions from "../components/ModalFormActions";
import SimpleRichTextEditor from "../components/SimpleRichTextEditor";
import { useImageUploadPreview } from "../components/useImageUploadPreview";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

export interface FeaturedLoftOption {
  id: number;
  title: string;
}

type EditItem = {
  id: number;
  title: string;
  content: string;
  /** Null when this post has no linked 合作鴿舍 — the select falls back to the "不指定" option. */
  loftId: number | null;
  /** Resolved to the site placeholder when the row has no image yet — see featuredLoftPostImageUrl/hero-placeholder.png in the caller. */
  imageUrl: string;
};

type Props = { mode: "create"; lofts: FeaturedLoftOption[] } | { mode: "edit"; lofts: FeaturedLoftOption[]; item: EditItem };

// Same create/edit modal split pattern as app/z04urru6/news/NewsFormModal.tsx
// (issue #176 models this feature directly on 最新訊息) — minus the 電子報
// block, which this feature deliberately never has (see
// lib/featuredLoftPosts.ts's header comment). Submits FormData (not JSON) —
// 主圖 must be (re)selected on every submit, create or edit alike, same
// convention as NewsFormModal/PigeonShowcaseFormModal.
//
// The 鴿舍 select follows
// app/z04urru6/pigeon-showcase/PigeonShowcaseFormModal.tsx's dropdown shape,
// except it's genuinely optional here — an explicit "不指定" option, not a
// required field — since loft_id is nullable (issue #176; unlike
// pigeon_showcase.loft_id, which is required).
export default function FeaturedLoftPostFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.item.title : "");
  const [content, setContent] = useState(isEdit ? props.item.content : "");
  const [loftId, setLoftId] = useState(isEdit && props.item.loftId ? String(props.item.loftId) : "");
  const image = useImageUploadPreview(isEdit ? props.item.imageUrl : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle(isEdit ? props.item.title : "");
    setContent(isEdit ? props.item.content : "");
    setLoftId(isEdit && props.item.loftId ? String(props.item.loftId) : "");
    setError(null);
    image.reset();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const file = image.selectedFile();
    if (!file) {
      setError("請上傳主圖");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("content", content);
    formData.set("image", file);
    // Omitted entirely (rather than sent as "") when unset, so the API
    // route's `loftIdRaw ? Number(loftIdRaw) : null` reads it the same way
    // either way — this just keeps the request body tidy.
    if (loftId) formData.set("loftId", loftId);

    const response = await fetch(isEdit ? `/api/admin/featured-lofts/${props.item.id}` : "/api/admin/featured-lofts", {
      method: isEdit ? "PATCH" : "POST",
      body: formData,
    });
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
        {isEdit ? "編輯" : "＋ 新增文章"}
      </button>

      {open && (
        <AdminModal title={isEdit ? "編輯名家專區文章" : "新增名家專區文章"} size="xl">
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              標題
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required className={inputClass} />
            </label>

            <ImageUploadField
              label="主圖"
              fileInputRef={image.fileInputRef}
              previewUrl={image.previewUrl}
              onChange={image.handleFileChange}
            />

            <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              內容
              <SimpleRichTextEditor value={content} onChange={setContent} maxLength={CONTENT_MAX} />
            </div>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              鴿舍（選填）
              <select value={loftId} onChange={(e) => setLoftId(e.target.value)} className={inputClass}>
                <option value="">不指定</option>
                {props.lofts.map((loft) => (
                  <option key={loft.id} value={loft.id}>
                    {loft.title}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink-light">設定後，文章詳情頁會顯示「查看商品」按鈕，連到該鴿舍的商品列表。</span>
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
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
