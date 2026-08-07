"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TITLE_MAX } from "@/lib/newsValidation";
import NewsDescriptionEditor from "./NewsDescriptionEditor";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

type EditItem = {
  id: number;
  title: string;
  content: string;
};

type Props = { mode: "create" } | { mode: "edit"; item: EditItem };

// Same create/edit modal split pattern as
// app/z04urru6/pigeon-showcase/PigeonShowcaseFormModal.tsx — one component
// doubles as both forms, differing only in submit verb/URL, initial values,
// and (create-mode only, issue #73) the newsletter sync checkbox. Submits
// JSON (not FormData) since news_posts has no file upload.
export default function NewsFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.item.title : "");
  const [content, setContent] = useState(isEdit ? props.item.content : "");
  // Create-mode-only opt-in (issue #73): checking this at creation time IS
  // the confirmation to broadcast — no separate review/test-send step like
  // the standalone NewsletterComposer has, so it always defaults unchecked
  // and is never offered while editing an existing post (to avoid
  // re-sending or accidentally triggering a send on an edit).
  const [sendNewsletter, setSendNewsletter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle(isEdit ? props.item.title : "");
    setContent(isEdit ? props.item.content : "");
    setSendNewsletter(false);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = isEdit ? { title, content } : { title, content, sendNewsletter };
    const response = await fetch(isEdit ? `/api/admin/news/${props.item.id}` : "/api/admin/news", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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

    // Newsletter send is best-effort and independent of the news post
    // itself (issue #73) — the post above is already saved successfully by
    // this point, so a broadcast failure surfaces here as its own notice
    // instead of blocking/rolling back the save.
    if (!isEdit && sendNewsletter && data.newsletterError) {
      alert(`最新訊息已成功儲存，但電子報寄送失敗：${data.newsletterError}`);
    }
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
                內容
                <NewsDescriptionEditor value={content} onChange={setContent} />
              </div>

              {!isEdit && (
                <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
                  <input
                    type="checkbox"
                    checked={sendNewsletter}
                    onChange={(e) => setSendNewsletter(e.target.checked)}
                    disabled={submitting}
                  />
                  同步發送電子報
                </label>
              )}

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
