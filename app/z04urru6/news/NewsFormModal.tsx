"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TITLE_MAX } from "@/lib/newsValidation";
import NewsDescriptionEditor from "./NewsDescriptionEditor";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

type EditItem = {
  id: number;
  title: string;
  content: string;
  /** Resolved to the site placeholder when the row has no image yet (pre-issue-#70 data) — see newsImageUrl/hero-placeholder.png in the caller. */
  imageUrl: string;
};

type Props = { mode: "create" } | { mode: "edit"; item: EditItem };

// Same create/edit modal split pattern as
// app/z04urru6/pigeon-showcase/PigeonShowcaseFormModal.tsx — one component
// doubles as both forms, differing only in submit verb/URL and initial
// values. Submits FormData (not JSON) as of issue #70's required 主圖 field
// — must be (re)selected on every submit, create or edit alike, per issue
// #70's explicit "新增／編輯時前後端都強制要求上傳" requirement.
export default function NewsFormModal(props: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = props.mode === "edit";

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.item.title : "");
  const [content, setContent] = useState(isEdit ? props.item.content : "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(isEdit ? props.item.imageUrl : null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle(isEdit ? props.item.title : "");
    setContent(isEdit ? props.item.content : "");
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return isEdit ? props.item.imageUrl : null;
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
    if (!file) {
      setError("請上傳主圖");
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("content", content);
    formData.set("image", file);

    const response = await fetch(isEdit ? `/api/admin/news/${props.item.id}` : "/api/admin/news", {
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isEdit
            ? "rounded-md border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            : "rounded-lg bg-interactive-primary px-4 py-2 text-sm font-medium text-white hover:bg-interactive-primary-active"
        }
      >
        {isEdit ? "編輯" : "＋ 新增訊息"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-lg font-semibold">{isEdit ? "編輯訊息" : "新增訊息"}</h2>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                標題
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={TITLE_MAX} required className={inputClass} />
              </label>

              <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                主圖
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

              <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                內容
                <NewsDescriptionEditor value={content} onChange={setContent} />
              </div>

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
