"use client";

import { useTranslations } from "next-intl";
import { breakdownRemainingMs } from "@/lib/format";
import { useListingCountdown } from "@/lib/useListingCountdown";

interface HeroCountdownStripProps {
  listingId: number;
  imageUrl: string;
  initialCurrentPrice: number;
  initialBuyItNowPrice: number | null;
  initialEndsAt: string;
  /** ISO 8601 string, or null — set only while status is 'scheduled'. */
  initialStartsAt: string | null;
  initialStatus: string;
  /** ISO 8601 string captured once by the server component — see useListingCountdown. */
  renderedAt: string;
}

// Photo-hero glass strip for the listing detail page, styled after the
// homepage's HeroSection stat cards (same bg-white/12 + backdrop-blur-sm
// treatment) but with the remaining-time card rendered as digit tiles
// instead of a text sentence. Shares its live data with LiveListingStatus
// via useListingCountdown rather than polling independently.
export default function HeroCountdownStrip({
  listingId,
  imageUrl,
  initialCurrentPrice,
  initialBuyItNowPrice,
  initialEndsAt,
  initialStartsAt,
  initialStatus,
  renderedAt,
}: HeroCountdownStripProps) {
  const tDetail = useTranslations("listingDetail");
  const tFormat = useTranslations("format");
  const { currentPrice, showingCountdownToStart, remainingMs } = useListingCountdown({
    listingId,
    initialCurrentPrice,
    initialEndsAt,
    initialStartsAt,
    initialStatus,
    renderedAt,
  });

  const { days, hours, minutes, seconds } = breakdownRemainingMs(remainingMs);
  const countdownLabel = showingCountdownToStart ? tFormat("startsInPrefix") : tDetail("specEndTime");
  const tiles = [
    { value: days, label: tFormat("unitDays") },
    { value: hours, label: tFormat("unitHours") },
    { value: minutes, label: tFormat("unitMinutes") },
    { value: seconds, label: tFormat("unitSeconds") },
  ];
  const hasBuyout = initialBuyItNowPrice !== null;

  return (
    <section className="relative isolate flex min-h-[220px] items-end overflow-hidden rounded-[28px] shadow-[0_25px_70px_rgba(15,23,42,0.22)] sm:min-h-[280px]">
      <div className="absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" aria-hidden="true" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-blue-950/60 to-indigo-900/30" />
      </div>

      <div className={`relative z-10 grid w-full gap-2 p-6 text-xs text-blue-100 sm:text-sm ${hasBuyout ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div className="rounded-xl border border-white/10 bg-white/12 px-4 py-3 backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-blue-200">{tDetail("specCurrentPrice")}</p>
          <p className="mt-1 text-base font-bold text-white">{currentPrice}</p>
        </div>

        {hasBuyout && (
          <div className="rounded-xl border border-white/10 bg-white/12 px-4 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.16em] text-blue-200">{tDetail("specBuyNow")}</p>
            <p className="mt-1 text-base font-bold text-white">{initialBuyItNowPrice}</p>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/12 px-4 py-3 backdrop-blur-sm">
          <p className="text-[11px] uppercase tracking-[0.16em] text-blue-200">{countdownLabel}</p>
          <div className="mt-2 flex gap-1.5">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="flex min-w-[2.5rem] flex-1 flex-col items-center rounded-lg border border-white/10 bg-white/12 py-1.5 backdrop-blur-sm"
              >
                <span className="text-base font-black leading-none text-white">{String(tile.value).padStart(2, "0")}</span>
                <span className="mt-1 text-[9px] uppercase tracking-wide text-blue-200">{tile.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
