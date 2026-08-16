"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CONTENT_MAX, TITLE_MAX } from "@/lib/newsValidation";
import { BROADCAST_STATUS_LABEL } from "@/lib/broadcastStatusLabel";
import type { BroadcastStatus } from "@/lib/newsletter";
import { MODAL_TRIGGER_CLASS } from "../components/adminButtonClasses";
import AdminModal from "../components/AdminModal";
import ImageUploadField from "../components/ImageUploadField";
import ModalFormActions from "../components/ModalFormActions";
import SimpleRichTextEditor from "../components/SimpleRichTextEditor";
import { useImageUploadPreview } from "../components/useImageUploadPreview";

const inputClass = "w-full rounded-md border border-border px-3 py-2 text-sm focus:border-interactive-primary focus:outline-none";

// Only the fields NewsFormModal needs to decide what to show/submit — the
// caller (page.tsx) resolves this live against Resend (via listBroadcasts),
// same "always live, never cached" status story as the old standalone
// newsletter page had.
export type NewsBroadcastInfo = { id: string; status: BroadcastStatus; scheduledAt: string | null };

type EditItem = {
  id: number;
  title: string;
  content: string;
  /** Resolved to the site placeholder when the row has no image yet (pre-issue-#70 data) — see newsImageUrl/hero-placeholder.png in the caller. */
  imageUrl: string;
  /** NULL when no newsletter has ever been associated with this post (issue #80). */
  broadcast: NewsBroadcastInfo | null;
};

type Props = { mode: "create" } | { mode: "edit"; item: EditItem };

function toLocalDatetimeValue(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Same create/edit modal split pattern as
// app/z04urru6/pigeon-showcase/PigeonShowcaseFormModal.tsx — one component
// doubles as both forms, differing only in submit verb/URL and initial
// values. Submits FormData (not JSON) as of issue #70's required 主圖 field —
// must be (re)selected on every submit, create or edit alike, per issue
// #70's explicit "新增／編輯時前後端都強制要求上傳" requirement.
//
// 電子報 (issue #80): the checkbox started create-mode-only (#73) but now
// works in both modes — editing can add/remove/reschedule a send as long as
// the linked broadcast hasn't reached "sent" yet (locked below). Checking it
// IS the confirmation to (re)send, same as #73's original design — no
// separate review/test-send step, and no extra confirm() dialog.
export default function NewsFormModal(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const broadcast = isEdit ? props.item.broadcast : null;
  const locked = broadcast?.status === "sent";

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(isEdit ? props.item.title : "");
  const [content, setContent] = useState(isEdit ? props.item.content : "");
  const image = useImageUploadPreview(isEdit ? props.item.imageUrl : null);
  // Defaults to whatever's currently active: unchecked when there's no
  // broadcast yet (or the last one was canceled — canceled reads the same
  // as "nothing pending" here), checked for draft/scheduled/queued/sent.
  const [sendNewsletter, setSendNewsletter] = useState(Boolean(broadcast) && broadcast?.status !== "canceled");
  const [scheduleEnabled, setScheduleEnabled] = useState(Boolean(broadcast?.scheduledAt));
  const [scheduledAt, setScheduledAt] = useState(broadcast?.scheduledAt ? toLocalDatetimeValue(broadcast.scheduledAt) : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setTitle(isEdit ? props.item.title : "");
    setContent(isEdit ? props.item.content : "");
    setSendNewsletter(Boolean(broadcast) && broadcast?.status !== "canceled");
    setScheduleEnabled(Boolean(broadcast?.scheduledAt));
    setScheduledAt(broadcast?.scheduledAt ? toLocalDatetimeValue(broadcast.scheduledAt) : "");
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

    let scheduledAtIso: string | undefined;
    if (!locked && sendNewsletter && scheduleEnabled) {
      const parsed = scheduledAt ? new Date(scheduledAt) : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setError("請選擇一個有效的未來排程時間");
        return;
      }
      scheduledAtIso = parsed.toISOString();
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("content", content);
    formData.set("image", file);
    // Sent unconditionally (both modes, whatever the checkbox currently
    // reads) — the API route is the authority on what's actually still
    // editable, so this is just "what the admin asked for", not a guarantee.
    formData.set("sendNewsletter", sendNewsletter ? "true" : "false");
    if (scheduledAtIso) formData.set("scheduledAt", scheduledAtIso);

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

    // Newsletter send/cancel is best-effort and independent of the news post
    // itself (issue #73, extended by #80) — the post above is already saved
    // successfully by this point, so a broadcast failure surfaces here as
    // its own notice instead of blocking/rolling back the save.
    if (data.newsletterError) {
      alert(`最新訊息已成功儲存，但電子報處理失敗：${data.newsletterError}`);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={MODAL_TRIGGER_CLASS(isEdit)}
      >
        {isEdit ? "編輯" : "＋ 新增訊息"}
      </button>

      {open && (
        <AdminModal title={isEdit ? "編輯訊息" : "新增訊息"} size="xl">
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

            <div className="rounded-md border border-border p-3">
              {locked ? (
                <p className="text-sm text-ink-light">
                  電子報已寄出（{BROADCAST_STATUS_LABEL[broadcast!.status] ?? broadcast!.status}），內容修改不會回頭更新已寄出的信，也無法重寄。
                </p>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
                    <input
                      type="checkbox"
                      checked={sendNewsletter}
                      onChange={(e) => setSendNewsletter(e.target.checked)}
                      disabled={submitting}
                    />
                    同時發送電子報
                  </label>
                  {broadcast && (
                    <p className="mt-1 text-xs text-ink-light">
                      目前狀態：{BROADCAST_STATUS_LABEL[broadcast.status] ?? broadcast.status}
                      {sendNewsletter && "（儲存後會以目前標題／內容重新建立並寄送，取代這個狀態）"}
                    </p>
                  )}
                  {sendNewsletter && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
                        <input
                          type="checkbox"
                          checked={scheduleEnabled}
                          onChange={(e) => setScheduleEnabled(e.target.checked)}
                          disabled={submitting}
                        />
                        排程寄送（未勾選則立即寄送）
                      </label>
                      {scheduleEnabled && (
                        <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
                          排程時間
                          <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            disabled={submitting}
                            className="w-full max-w-xs rounded-md border border-border px-3 py-2 text-ink focus:border-interactive-primary focus:outline-none"
                          />
                        </label>
                      )}
                    </div>
                  )}
                </>
              )}
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
            />
          </form>
        </AdminModal>
      )}
    </>
  );
}
