"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Editor } from "@tinymce/tinymce-react";

type Status = "idle" | "testing" | "sending";

export default function NewsletterComposer() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const contentReady = subject.trim() !== "" && html.trim() !== "";

  async function handleTestSend() {
    setStatus("testing");
    setMessage(null);

    const response = await fetch("/api/admin/newsletter/test-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, html }),
    }).catch(() => null);
    const data = await response?.json().catch(() => null);

    setStatus("idle");
    if (data?.ok) {
      setMessage({ kind: "success", text: "測試信已寄到你自己的信箱，請確認排版與內容。" });
    } else {
      setMessage({ kind: "error", text: data?.error ?? "測試寄送失敗，請稍後再試。" });
    }
  }

  async function handleSend() {
    let scheduledAtIso: string | undefined;
    if (scheduleEnabled) {
      const parsed = scheduledAt ? new Date(scheduledAt) : null;
      if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setMessage({ kind: "error", text: "請選擇一個有效的未來排程時間。" });
        return;
      }
      scheduledAtIso = parsed.toISOString();
    }

    const confirmText = scheduleEnabled
      ? "確定要排程寄送這封電子報嗎？時間到了會自動寄給所有訂閱者，寄出後無法收回。"
      : "確定要立即寄送這封電子報給所有訂閱者嗎？此動作無法收回。";
    if (!confirm(confirmText)) return;

    setStatus("sending");
    setMessage(null);

    const createResponse = await fetch("/api/admin/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, html }),
    }).catch(() => null);
    const createData = await createResponse?.json().catch(() => null);

    if (!createData?.ok) {
      setStatus("idle");
      setMessage({ kind: "error", text: createData?.error ?? "建立電子報失敗，請稍後再試。" });
      return;
    }

    const sendResponse = await fetch(`/api/admin/newsletter/${createData.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: scheduledAtIso }),
    }).catch(() => null);
    const sendData = await sendResponse?.json().catch(() => null);

    setStatus("idle");
    if (!sendData?.ok) {
      setMessage({ kind: "error", text: sendData?.error ?? "寄送失敗，請至列表確認草稿狀態。" });
      return;
    }

    router.push("/z04urru6/newsletter");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        主旨
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
          className="w-full rounded-md border border-border px-3 py-2 text-ink focus:border-gold focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm font-medium text-ink-light">
        內容
        <Editor
          tinymceScriptSrc="/tinymce/tinymce.min.js"
          licenseKey="gpl"
          value={html}
          onEditorChange={(next) => setHtml(next)}
          init={{
            height: 480,
            menubar: false,
            plugins: ["link", "image", "lists", "table", "code"],
            toolbar:
              "undo redo | blocks | bold italic underline | bullist numlist | link image table | code",
          }}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink-light">
        <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
        排程寄送
      </label>
      {scheduleEnabled && (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-light">
          排程時間
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full max-w-xs rounded-md border border-border px-3 py-2 text-ink focus:border-gold focus:outline-none"
          />
        </label>
      )}

      {message && (
        <p className={`text-sm ${message.kind === "success" ? "text-emerald-600" : "text-ended"}`}>{message.text}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleTestSend}
          disabled={!contentReady || status !== "idle"}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "testing" ? "測試寄送中..." : "測試寄送給我自己"}
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!contentReady || status !== "idle"}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" ? "處理中..." : scheduleEnabled ? "建立並排程寄送" : "建立並立即寄送"}
        </button>
      </div>
    </div>
  );
}
