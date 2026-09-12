"use client";

// issue #255: manual trigger for the daily loing-ma.com/herbots.be races
// sync (issue #241), mirroring app/z04urru6/news/HerbotsNewsSyncButton.tsx's
// shape — a one-off log of the last run's outcome, not a persisted value
// (same reasoning as that component's header comment). The result shape has
// two independent sub-results (see lib/racesSync.ts's RacesSyncResult)
// instead of news' single flat result, so the message composes both halves.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseSyncApiResponse } from "../components/parseSyncApiResponse";

interface SourceSyncResult {
  imported: number;
  updated: number;
  errors: string[];
}

interface LoingMaSyncResult extends SourceSyncResult {
  skipped: boolean;
  skipReason?: string;
}

interface HerbotsSyncResult extends SourceSyncResult {
  translationFailures: number;
}

interface RacesSyncResult {
  loingMa: LoingMaSyncResult;
  herbots: HerbotsSyncResult;
}

interface SyncResponse {
  ok: boolean;
  error?: string;
  result?: RacesSyncResult;
}

function describeLoingMa(result: LoingMaSyncResult): string {
  if (result.skipped) {
    return `loing-ma.com：本次略過（${result.skipReason ?? "來源無法連線"}）`;
  }
  const base = `loing-ma.com：新增 ${result.imported} 筆，更新 ${result.updated} 筆`;
  return result.errors.length > 0 ? `${base}，${result.errors.length} 個錯誤：${result.errors.join("；")}` : base;
}

function describeHerbots(result: HerbotsSyncResult): string {
  const base = `herbots.be：新增 ${result.imported} 筆，更新 ${result.updated} 筆`;
  const translation = result.translationFailures > 0 ? `，翻譯失敗 ${result.translationFailures} 次（已以原文儲存）` : "";
  const errors = result.errors.length > 0 ? `，${result.errors.length} 個錯誤：${result.errors.join("；")}` : "";
  return `${base}${translation}${errors}`;
}

export default function RacesSyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/races/sync", { method: "POST" });
      const parsed = await parseSyncApiResponse<SyncResponse>(response);

      if (!parsed.ok || !parsed.data) {
        setStatus("error");
        setMessage(parsed.message ?? "同步失敗，原因不明");
        return;
      }

      const data = parsed.data;
      if (!data.ok || !data.result) {
        setStatus("error");
        setMessage(data.error ?? "同步失敗，原因不明");
        return;
      }

      const { loingMa, herbots } = data.result;
      const hasErrors = loingMa.errors.length > 0 || herbots.errors.length > 0;
      setStatus(hasErrors ? "error" : "success");
      setMessage(`${describeLoingMa(loingMa)}；${describeHerbots(herbots)}`);
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
        {status === "loading" ? "同步中..." : "立即手動同步賽事資訊"}
      </button>
      {message && (
        <p className={`max-w-md text-right text-xs ${status === "error" ? "text-ended" : "text-interactive-primary"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
