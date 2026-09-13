"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MODAL_TRIGGER_CLASS } from "../../components/adminButtonClasses";
import AdminModal from "../../components/AdminModal";
import ImageUploadField from "../../components/ImageUploadField";
import ModalFormActions from "../../components/ModalFormActions";
import SimpleRichTextEditor from "../../components/SimpleRichTextEditor";
import { useImageUploadPreview } from "../../components/useImageUploadPreview";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";
const TITLE_MAX = 255;
// Matches the FEATURED_LOFT_CONTENT_MAX cap enforced server-side by
// lib/homepageSectionApiValidation.ts (copied from the removed
// lib/featuredLoftPostValidation.ts's CONTENT_MAX, issue #176).
const CONTENT_MAX = 2000;

export interface FeaturedLoftOption {
  id: number;
  title: string;
}

type EditSection = {
  id: number;
  title: string;
  bio: string | null;
  linkedLoftId: number | null;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string;
};

type Props =
  | { mode: "create"; sectionType: string; lofts: FeaturedLoftOption[] }
  | { mode: "edit"; sectionType: string; lofts: FeaturedLoftOption[]; section: EditSection };

// 名家專區 (issue #270) — same create/edit modal split as
// ../partner-lofts/PartnerLoftFormModal.tsx, with two differences: 內容 is
// authored via SimpleRichTextEditor instead of a plain-text 簡介 textarea,
// and 關聯鴿舍 is a required select (source: listHomepageSections
// ("partner_loft"), passed down by the page) rather than absent — every
// featured_loft card must link to a partner_loft's /listings?loft=<id>.
export default function FeaturedLoftFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.section.title : "");
  const [content, setContent] = useState(isEdit ? (props.section.bio ?? "") : "");
  const [linkedLoftId, setLinkedLoftId] = useState(
    isEdit && props.section.linkedLoftId ? String(props.section.linkedLoftId) : "",
  );
  const [sortOrder, setSortOrder] = useState(isEdit ? String(props.section.sortOrder) : "");
  const [isActive, setIsActive] = useState(isEdit ? props.section.isActive : true);
  const image = useImageUploadPreview(isEdit ? props.section.imageUrl : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle(isEdit ? props.section.title : "");
    setContent(isEdit ? (props.section.bio ?? "") : "");
    setLinkedLoftId(isEdit && props.section.linkedLoftId ? String(props.section.linkedLoftId) : "");
    setSortOrder(isEdit ? String(props.section.sortOrder) : "");
    setIsActive(isEdit ? props.section.isActive : true);
    setError(null);
    image.reset();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const file = image.selectedFile();
    if (!isEdit && !file) {
      setError("請上傳圖片");
      return;
    }
    if (!linkedLoftId) {
      setError("請選擇關聯鴿舍");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("bio", content);
    formData.set("linkedLoftId", linkedLoftId);
    if (sortOrder.trim() !== "") formData.set("sortOrder", sortOrder.trim());
    formData.set("isActive", isActive ? "true" : "false");
    if (file) formData.set("image", file);

    let response: Response;
    if (isEdit) {
      response = await fetch(`/api/admin/homepage-sections/${props.section.id}`, { method: "PATCH", body: formData });
    } else {
      formData.set("sectionType", props.sectionType);
      response = await fetch("/api/admin/homepage-sections", { method: "POST", body: formData });
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={MODAL_TRIGGER_CLASS(isEdit)}
      >
        {isEdit ? "編輯" : "＋ 新增名家專區"}
      </button>

      {open && (
        <AdminModal title={isEdit ? "編輯名家專區" : "新增名家專區"} size="xl">
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              標題
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required className={inputClass} />
            </label>

            <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              內容
              <SimpleRichTextEditor value={content} onChange={setContent} maxLength={CONTENT_MAX} />
            </div>

            <ImageUploadField
              label={`圖片${isEdit ? "（留空表示不更換）" : ""}`}
              fileInputRef={image.fileInputRef}
              previewUrl={image.previewUrl}
              onChange={image.handleFileChange}
            />

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              關聯鴿舍
              <select value={linkedLoftId} onChange={(e) => setLinkedLoftId(e.target.value)} required className={inputClass}>
                <option value="" disabled>
                  請選擇關聯鴿舍
                </option>
                {props.lofts.map((loft) => (
                  <option key={loft.id} value={loft.id}>
                    {loft.title}
                  </option>
                ))}
              </select>
              {props.lofts.length === 0 ? (
                <span className="text-xs text-ended">目前沒有任何合作鴿舍，請先於「合作鴿舍管理」新增。</span>
              ) : (
                <span className="text-xs text-ink-light">首頁卡片點擊後會導向這個鴿舍的商品列表。</span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              排序（留空自動排在最後）
              <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} step={1} className={inputClass} />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              啟用中（於首頁顯示）
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
