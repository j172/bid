import { getTranslations } from "next-intl/server";
import { getAllLatestStoredRates } from "@/lib/exchangeRates";

// Footer exchange-rate card (issue #45, restyled + promoted in issue #49) —
// shown on every locale, not just zh-CN/en, since it's informational for any
// visitor. Reads whatever was last successfully synced by
// lib/scheduler.ts's cron job; shows an "updating" placeholder rather than
// nothing if the DB has no rate yet at all (e.g. right after a first-ever
// deploy, before the first sync completes).
//
// Restyled (issue #49) to match the newsletter card's treatment right below
// it in SiteFooter — same rounded-2xl + gradient + large heading — using a
// steel-azure-tinted radial gradient (this design system's secondary/brand
// tone, see app/styles/design-tokens.css) rather than the newsletter card's
// blue, so the two read as related but distinct. No outer wrapper here
// (unlike the old bg-slate-50 strip) — SiteFooter places this directly
// inside its own max-w-6xl/px-4 container, right above the newsletter card.
//
// `className` (issue #150) lets a second call site — the homepage's
// news/pigeon-showcase grid — merge in height-stretching flex classes so
// this card's gradient box can grow to fill leftover column height, while
// SiteFooter's existing call (no className passed) keeps its original
// fixed-content sizing unchanged.
interface ExchangeRateStripProps {
  className?: string;
}

export default async function ExchangeRateStrip({ className }: ExchangeRateStripProps = {}) {
  const [t, rates] = await Promise.all([getTranslations("footer"), getAllLatestStoredRates()]);

  return (
    <section
      className={`rounded-2xl bg-[radial-gradient(circle_at_top_right,_#d9edf2_0,_#ecf6f9_40%,_#f8fafc_100%)] px-6 py-7${className ? ` ${className}` : ""}`}
    >
      <h3 className="text-2xl font-black text-ink">{t("exchangeRateTitle")}</h3>
      <div className="mt-3 flex flex-col gap-1.5 text-sm font-semibold text-ink sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <span>{rates.USD ? t("exchangeRateUsd", { rate: rates.USD.rate.toFixed(2) }) : t("exchangeRateUnavailable")}</span>
        <span>{rates.CNY ? t("exchangeRateCny", { rate: rates.CNY.rate.toFixed(2) }) : t("exchangeRateUnavailable")}</span>
      </div>
      <p className="mt-2 text-xs italic text-ink-light">{t("exchangeRateDisclaimer")}</p>
    </section>
  );
}
