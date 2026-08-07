"use client";

// issue #55: front-end "即時參考匯率" was stuck on "更新中" because the
// scheduled sync had been failing silently (see lib/exchangeRates.ts's
// header comment). This panel lets an admin retry the sync on demand and
// see immediately whether it worked — and if not, exactly why — instead of
// needing an engineer to SSH in and read pm2 logs.
import { useState } from "react";

export interface ExchangeRateDisplay {
  currency: "USD" | "CNY";
  rate: number;
  rateDate: string;
  sourceDate: string;
}

type StoredRates = Record<"USD" | "CNY", ExchangeRateDisplay | null>;

interface SyncResponse {
  ok: boolean;
  error?: string;
  result?: {
    fetchedFresh: boolean;
    updated: { currency: "USD" | "CNY"; rate: number; sourceDate: string; usedFallback: boolean }[];
    failed: ("USD" | "CNY")[];
  };
}

interface RatesResponse {
  ok: boolean;
  rates?: StoredRates;
}

function formatRate(rate: ExchangeRateDisplay | null): string {
  if (!rate) return "尚無資料";
  return `${rate.rate} （來源日期：${rate.sourceDate}）`;
}

export default function ExchangeRateSyncPanel({ initialRates }: { initialRates: StoredRates }) {
  const [rates, setRates] = useState<StoredRates>(initialRates);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/admin/exchange-rates/sync", { method: "POST" });
      const data: SyncResponse = await response.json();

      if (!data.ok) {
        setStatus("error");
        setMessage(data.error ?? "同步失敗，原因不明");
        return;
      }

      const usedFallback = data.result?.updated.some((row) => row.usedFallback) ?? false;
      setStatus("success");
      setMessage(
        data.result?.fetchedFresh && !usedFallback
          ? "同步成功，已取得最新 TAIFEX 匯率。"
          : "同步完成，但 TAIFEX 目前無新資料，已沿用先前成功同步的匯率。",
      );

      const ratesResponse = await fetch("/api/admin/exchange-rates/sync");
      const ratesData: RatesResponse = await ratesResponse.json();
      if (ratesData.ok && ratesData.rates) {
        setRates(ratesData.rates);
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "同步失敗：無法連線至伺服器");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">即時參考匯率同步</h2>
          <p className="mt-1 text-sm text-ink-light">
            每日 08:10（台北時間）自動同步。若前台匯率卡在「更新中」，可在此手動重新觸發並立即查看結果。
          </p>
        </div>
        <button
          type="button"
          onClick={handleSync}
          disabled={status === "loading"}
          className="shrink-0 rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "同步中..." : "立即手動同步匯率"}
        </button>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${status === "error" ? "text-ended" : "text-interactive-primary"}`}>{message}</p>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["USD", "CNY"] as const).map((currency) => (
          <div key={currency} className="rounded-lg border border-border p-3">
            <dt className="text-xs text-ink-light">TWD / {currency}</dt>
            <dd className="mt-1 text-sm font-semibold">{formatRate(rates[currency])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
