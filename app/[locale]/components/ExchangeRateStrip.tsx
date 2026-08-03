import { getTranslations } from "next-intl/server";
import { getAllLatestStoredRates } from "@/lib/exchangeRates";

// Persistent footer exchange-rate strip (issue #45) — shown on every locale,
// not just zh-CN/en, since it's informational for any visitor. Reads
// whatever was last successfully synced by lib/scheduler.ts's cron job;
// shows an "updating" placeholder rather than nothing if the DB has no rate
// yet at all (e.g. right after a first-ever deploy, before the first sync
// completes).
export default async function ExchangeRateStrip() {
  const [t, rates] = await Promise.all([getTranslations("footer"), getAllLatestStoredRates()]);

  return (
    <div className="border-t border-border bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-3 text-center text-xs text-ink-light sm:flex-row sm:justify-center sm:gap-4 sm:px-6">
        <span className="font-semibold text-ink">{t("exchangeRateTitle")}</span>
        <span>{rates.USD ? t("exchangeRateUsd", { rate: rates.USD.rate.toFixed(2) }) : t("exchangeRateUnavailable")}</span>
        <span>{rates.CNY ? t("exchangeRateCny", { rate: rates.CNY.rate.toFixed(2) }) : t("exchangeRateUnavailable")}</span>
        <span className="italic">{t("exchangeRateDisclaimer")}</span>
      </div>
    </div>
  );
}
