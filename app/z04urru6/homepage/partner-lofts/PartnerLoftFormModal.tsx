"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";
const TITLE_MAX = 255;
const LINK_URL_MAX = 500;

type EditSection = {
  id: number;
  title: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
  imageUrl: string;
};

type Props = { mode: "create"; sectionType: string } | { mode: "edit"; sectionType: string; section: EditSection };

// Single modal component doubles as both the "新增" and "編輯" form for
// homepage_sections rows — same fields either way, the only real
// differences are which HTTP verb/URL it submits to and whether the image
// file is required (create: yes: edit: optional, omitting it keeps the
// existing image per the PATCH route's contract). Mirrors the create/edit
// modal split pattern from app/z04urru6/listings/EditListingModal.tsx, just
// collapsed into one component since the form is much smaller here.
export default function PartnerLoftFormModal(props: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = props.mode === "edit";

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.section.title : "");
  const [linkUrl, setLinkUrl] = useState(isEdit ? props.section.linkUrl : "");
  const [sortOrder, setSortOrder] = useState(isEdit ? String(props.section.sortOrder) : "");
  const [isActive, setIsActive] = useState(isEdit ? props.section.isActive : true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(isEdit ? props.section.imageUrl : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle(isEdit ? props.section.title : "");
    setLinkUrl(isEdit ? props.section.linkUrl : "");
    setSortOrder(isEdit ? String(props.section.sortOrder) : "");
    setIsActive(isEdit ? props.section.isActive : true);
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return isEdit ? props.section.imageUrl : null;
    });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!isEdit && !file) {
      setError("請上傳圖片");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("linkUrl", linkUrl);
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
        className={
          isEdit
            ? "rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            : "rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active"
        }
      >
        {isEdit ? "編輯" : "＋ 新增合作鴿舍"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold">{isEdit ? "編輯合作鴿舍" : "新增合作鴿舍"}</h2>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                標題
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required className={inputClass} />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                連結網址
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="例如 /listings?type=auction 或 https://example.com"
                  maxLength={LINK_URL_MAX}
                  required
                  className={inputClass}
                />
              </label>

              <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                圖片{isEdit ? "（留空表示不更換）" : ""}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="text-sm"
                />
                {previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="mt-2 h-24 w-24 rounded-md border border-border object-cover" />
                )}
              </div>

              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                排序（留空自動排在最後）
                <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" min={0} step={1} className={inputClass} />
              </label>

              <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                啟用中（於首頁顯示）
              </label>

              {error && <p className="text-sm text-ended">{error}</p>}
              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  disabled={submitting}
                  className="rounded-md border border-border px-4 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-header px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "儲存中..." : "儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
