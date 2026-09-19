"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DESCRIPTION_MAX, NAME_MAX, type PigeonShowcaseCategory } from "@/lib/pigeonShowcaseValidation";
import { MODAL_TRIGGER_CLASS } from "../components/adminButtonClasses";
import AdminModal from "../components/AdminModal";
import ImageUploadField from "../components/ImageUploadField";
import ModalFormActions from "../components/ModalFormActions";
import SimpleRichTextEditor, { type SimpleRichTextEditorHandle } from "../components/SimpleRichTextEditor";
import { useSuccessBanner } from "../components/SuccessBanner";
import { useImageUploadPreview } from "../components/useImageUploadPreview";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

export interface PigeonLoftOption {
  id: number;
  title: string;
}

type EditItem = {
  id: number;
  category: PigeonShowcaseCategory;
  name: string;
  loftId: number | null;
  photoSource: string | null;
  description: string;
  /** Resolved to the site placeholder when the row has no image yet (pre-issue-#70 data) — see pigeonShowcaseImageUrl/logo.png in the caller. */
  imageUrl: string;
};

type Props = { mode: "create"; lofts: PigeonLoftOption[] } | { mode: "edit"; lofts: PigeonLoftOption[]; item: EditItem };

const CATEGORY_LABEL: Record<PigeonShowcaseCategory, string> = {
  award: "入賞鴿",
  imported: "進口鴿",
  representative: "代表種鴿",
  world_famous: "世界名鴿",
};

// Same create/edit modal split pattern as
// app/z04urru6/homepage/partner-lofts/PartnerLoftFormModal.tsx — one
// component doubles as both forms, differing only in submit verb/URL and
// initial values. Submits FormData (not JSON) as of issue #70's required
// 主圖 field — unlike PartnerLoftFormModal's image (optional to replace on
// edit, keeps the existing file when omitted), the main image here must be
// (re)selected on every submit, create or edit alike, per issue #70's
// explicit "新增／編輯時前後端都強制要求上傳" requirement.
export default function PigeonShowcaseFormModal(props: Props) {
  const router = useRouter();
  const showBanner = useSuccessBanner();
  const isEdit = props.mode === "edit";
  const descriptionEditorRef = useRef<SimpleRichTextEditorHandle>(null);

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<PigeonShowcaseCategory>(isEdit ? props.item.category : "award");
  const [name, setName] = useState(isEdit ? props.item.name : "");
  const [loftId, setLoftId] = useState(
    isEdit ? (props.item.loftId != null ? String(props.item.loftId) : "") : (props.lofts[0] ? String(props.lofts[0].id) : ""),
  );
  const [photoSource, setPhotoSource] = useState(isEdit ? (props.item.photoSource ?? "") : "");
  const [description, setDescription] = useState(isEdit ? props.item.description : "");
  const image = useImageUploadPreview(isEdit ? props.item.imageUrl : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setCategory(isEdit ? props.item.category : "award");
    setName(isEdit ? props.item.name : "");
    setLoftId(
      isEdit ? (props.item.loftId != null ? String(props.item.loftId) : "") : (props.lofts[0] ? String(props.lofts[0].id) : ""),
    );
    setPhotoSource(isEdit ? (props.item.photoSource ?? "") : "");
    setDescription(isEdit ? props.item.description : "");
    setError(null);
    image.reset();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (category !== "world_famous" && !loftId) {
      setError("請選擇鴿舍");
      return;
    }
    const file = image.selectedFile();
    if (!file) {
      setError("請上傳主圖");
      return;
    }

    setSubmitting(true);
    const { html: descriptionHtml, images: descriptionImages } = descriptionEditorRef.current!.extractForSubmit();
    const formData = new FormData();
    formData.set("category", category);
    formData.set("name", name);
    if (loftId) {
      formData.set("loftId", loftId);
    }
    if (photoSource) {
      formData.set("photoSource", photoSource);
    }
    formData.set("description", descriptionHtml);
    formData.set("image", file);
    for (const descriptionImage of descriptionImages) {
      formData.append("descriptionImages", descriptionImage);
    }

    const response = await fetch(isEdit ? `/api/admin/pigeon-showcase/${props.item.id}` : "/api/admin/pigeon-showcase", {
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
    showBanner(isEdit ? "updated" : "created");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={MODAL_TRIGGER_CLASS(isEdit)}
      >
        {isEdit ? "編輯" : "＋ 新增鴿況"}
      </button>

      {open && (
        <AdminModal title={isEdit ? "編輯鴿況" : "新增鴿況"} size="xl">
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              鴿種
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PigeonShowcaseCategory)}
                className={inputClass}
              >
                {(Object.keys(CATEGORY_LABEL) as PigeonShowcaseCategory[]).map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              名稱
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} required className={inputClass} />
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              鴿舍 {category === "world_famous" && <span className="text-xs text-ink-light font-normal">（世界名鴿可不填）</span>}
              <select
                value={loftId}
                onChange={(e) => setLoftId(e.target.value)}
                required={category !== "world_famous"}
                className={inputClass}
              >
                <option value="">
                  {category === "world_famous" ? "未指定鴿舍" : "請選擇鴿舍"}
                </option>
                {props.lofts.map((loft) => (
                  <option key={loft.id} value={loft.id}>
                    {loft.title}
                  </option>
                ))}
              </select>
              {category !== "world_famous" && props.lofts.length === 0 && (
                <span className="text-xs text-ended">目前沒有任何合作鴿舍，請先於「合作鴿舍管理」新增。</span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              照片來源
              <select
                value={photoSource}
                onChange={(e) => setPhotoSource(e.target.value)}
                className={inputClass}
              >
                <option value="">未指定</option>
                <option value="三豐攝影">三豐攝影</option>
                <option value="舍內自拍">舍內自拍</option>
                <option value="其他">其他</option>
              </select>
            </label>

            <ImageUploadField
              label="主圖"
              fileInputRef={image.fileInputRef}
              previewUrl={image.previewUrl}
              onChange={image.handleFileChange}
            />

            <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
              簡介
              <SimpleRichTextEditor
                ref={descriptionEditorRef}
                value={description}
                onChange={setDescription}
                maxLength={DESCRIPTION_MAX}
              />
            </div>

            {error && <p className="text-sm text-ended">{error}</p>}
            <ModalFormActions
              onCancel={() => {
                setOpen(false);
                resetForm();
              }}
              submitting={submitting}
              submitLabel="儲存"
              pendingLabel="儲存中..."
              submitDisabled={category !== "world_famous" && props.lofts.length === 0}
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
