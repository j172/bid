"use client";

// issue #240: manual trigger for the daily herbots.be news sync, mirroring
// app/z04urru6/ExchangeRateSyncPanel.tsx's "let an admin retry on demand
// instead of SSHing in to read logs" shape, just without that panel's
// persistent stored-value display (a sync result here is a one-off log, not
// an ongoing value like the exchange rate strip).
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SyncResult {
  imported: number;
  skippedExisting: number;
  skippedNoContent: number;
  translationFailures: number;
  errors: string[];
}

interface SyncResponse {
  ok: boolean;
  error?: string;
  result?: SyncResult;
}

export default function HerbotsNewsSyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/news/sync", { method: "POST" });
      const data: SyncResponse = await response.json();

      if (!data.ok || !data.result) {
        setStatus("error");
        setMessage(data.error ?? "同步失敗，原因不明");
        return;
      }

      const { imported, skippedExisting, skippedNoContent, translationFailures, errors } = data.result;
      setStatus(errors.length > 0 ? "error" : "success");
      setMessage(
        `新增 ${imported} 篇，略過已匯入 ${skippedExisting} 篇，無內容略過 ${skippedNoContent} 篇` +
          (translationFailures > 0 ? `，翻譯失敗 ${translationFailures} 次（已以原文儲存）` : "") +
          (errors.length > 0 ? `，${errors.length} 個錯誤：${errors.join("；")}` : ""),
      );
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "同步失敗：無法連線至伺服器");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSync}
        disabled={status === "loading"}
        className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "loading" ? "同步中..." : "立即手動同步 herbots.be 新聞"}
      </button>
      {message && (
        <p className={`max-w-sm text-right text-xs ${status === "error" ? "text-ended" : "text-interactive-primary"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
