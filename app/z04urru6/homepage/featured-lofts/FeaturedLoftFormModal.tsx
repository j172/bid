"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MODAL_TRIGGER_CLASS } from "../../components/adminButtonClasses";
import AdminModal from "../../components/AdminModal";
import ImageUploadField from "../../components/ImageUploadField";
import ModalFormActions from "../../components/ModalFormActions";
import { useImageUploadPreview } from "../../components/useImageUploadPreview";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";
const TITLE_MAX = 255;
const BIO_MAX = 2000;

type EditSection = {
  id: number;
  title: string;
  bio: string | null;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string;
};

type Props = { mode: "create"; sectionType: string } | { mode: "edit"; sectionType: string; section: EditSection };

// Single modal component doubles as both the "新增" and "編輯" form for
// homepage_sections rows — same fields either way, the only real
// differences are which HTTP verb/URL it submits to and whether the image
// file is required (create: yes; edit: optional, omitting it keeps the
// existing image per the PATCH route's contract). Direct copy of
// PartnerLoftFormModal.tsx's shape (issue #168) — 名家專區 is a fully
// independent homepage_sections section_type from 合作鴿舍/partner_loft,
// so it gets its own modal component rather than parameterizing that one.
export default function FeaturedLoftFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.section.title : "");
  const [bio, setBio] = useState(isEdit ? (props.section.bio ?? "") : "");
  const [sortOrder, setSortOrder] = useState(isEdit ? String(props.section.sortOrder) : "");
  const [isActive, setIsActive] = useState(isEdit ? props.section.isActive : true);
  const image = useImageUploadPreview(isEdit ? props.section.imageUrl : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle(isEdit ? props.section.title : "");
    setBio(isEdit ? (props.section.bio ?? "") : "");
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

    setSubmitting(true);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("bio", bio);
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
    const data = await response.json();

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
        <AdminModal title={isEdit ? "編輯名家專區" : "新增名家專區"} size="lg">
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              標題
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required className={inputClass} />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              簡介（選填）
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="簡短介紹這位名家"
                maxLength={BIO_MAX}
                rows={3}
                className={inputClass}
              />
            </label>

            <ImageUploadField
              label={`圖片${isEdit ? "（留空表示不更換）" : ""}`}
              fileInputRef={image.fileInputRef}
              previewUrl={image.previewUrl}
              onChange={image.handleFileChange}
            />

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              排序（留空自動排在最後）
              <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} step={1} className={inputClass} />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              啟用中（於前台顯示）
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
