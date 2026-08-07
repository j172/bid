"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import ProgressiveImage from "@/app/components/ProgressiveImage";
import ZoomableProductImage from "./ZoomableProductImage";
import { useHeroCountdown } from "@/lib/useHeroCountdown";

interface HeroCardItem {
  id: number;
  href: string;
  title: string;
  photoUrl: string;
  hasPhoto: boolean;
  currentPrice: number;
  buyItNowPrice: number | null;
  endsAt: string;
  bidCount: number;
}

interface HeroSectionProps {
  browseHref: string;
  cards: HeroCardItem[];
  topPriceCards: HeroCardItem[];
  renderedAt: string;
}

type FormatTranslator = (key: string, values?: Record<string, string | number>) => string;

const AUTOPLAY_INTERVAL_MS = 5_000;

// Sentence-style "剩餘 X 天 X 小時" / "剩餘 X 小時 X 分 X 秒" countdown text,
// used for the active card's top pill badge and each secondary card in the
// list. Isolated as its own component (rather than lifting a `nowMs` tick
// into HeroSection's own state, as the previous implementation did) so the
// per-second re-render this causes when under a day remains stays scoped to
// this small text node — see useHeroCountdown for why.
function RemainingText({
  endsAt,
  renderedAt,
  t,
}: {
  endsAt: string;
  renderedAt: string;
  t: FormatTranslator;
}) {
  const { ended, days, hours, minutes, seconds } = useHeroCountdown(endsAt, renderedAt);

  if (ended) {
    return <>{t("ended")}</>;
  }

  // >= 1 day remaining: keep the original day/hour granularity — no minutes
  // or seconds, so this text doesn't jitter while there's still a long time
  // left. < 1 day: precise to the second, per issue #58.
  const parts: string[] = [];
  if (days > 0) {
    parts.push(t("days", { count: days }));
    if (hours > 0) parts.push(t("hours", { count: hours }));
  } else {
    parts.push(t("hours", { count: hours }));
    parts.push(t("minutes", { count: minutes }));
    parts.push(t("seconds", { count: seconds }));
  }

  const prefix = t("remainingPrefix");
  return <>{prefix ? `${prefix} ${parts.join(" ")}` : parts.join(" ")}</>;
}

// Digit-tile countdown (days/hours/minutes/seconds, ticking every second)
// for the active card's "結標時間/剩餘時間" stat box — modeled after the
// listing detail page's HeroCountdownStrip tiles. Isolated as its own
// component for the same re-render-scoping reason as RemainingText above.
function EndTimeCountdown({
  endsAt,
  renderedAt,
  t,
}: {
  endsAt: string;
  renderedAt: string;
  t: FormatTranslator;
}) {
  const { ended, days, hours, minutes, seconds } = useHeroCountdown(endsAt, renderedAt);

  if (ended) {
    return <p className="mt-1 text-base font-bold text-white">{t("ended")}</p>;
  }

  const tiles = [
    { value: days, label: t("unitDays") },
    { value: hours, label: t("unitHours") },
    { value: minutes, label: t("unitMinutes") },
    { value: seconds, label: t("unitSeconds") },
  ];

  return (
    <div className="mt-1.5 flex gap-1">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex min-w-[1.85rem] flex-1 flex-col items-center rounded-md bg-white/15 py-1"
        >
          <span className="text-sm font-black leading-none text-white">{String(tile.value).padStart(2, "0")}</span>
          <span className="mt-0.5 text-[8px] uppercase tracking-wide text-pacific-blue-200">{tile.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function HeroSection({
  browseHref,
  cards,
  topPriceCards,
  renderedAt,
}: HeroSectionProps) {
  const locale = useLocale();
  const tHome = useTranslations("home");
  const tListings = useTranslations("listings");
  const tDetail = useTranslations("listingDetail");
  const tFormat = useTranslations("format");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((index) => (cards.length === 0 ? 0 : Math.min(index, cards.length - 1)));
  }, [cards.length]);

  useEffect(() => {
    if (cards.length <= 1) return;

    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % cards.length);
    }, AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [cards.length]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const activeCard = cards[activeIndex];
  return (
    <section className="bg-gradient-to-b from-[#eef4ff] via-[#f4f7fb] to-[#f8fafc]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <article className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-yale-blue-950 to-yale-blue-900 p-7 text-white shadow-[0_25px_70px_rgba(15,23,42,0.22)] lg:col-span-2 lg:min-h-[440px] lg:p-9">
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-pacific-blue-400/20 blur-2xl" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-white/5 to-transparent" />

            {activeCard ? (
              <>
                <div className="relative z-10 max-w-[33rem]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-pacific-blue-100 backdrop-blur-sm">
                      {tHome("topBadge", { rank: activeIndex + 1 })}
                    </span>
                    <span className="inline-flex rounded-full border border-pacific-blue-300/30 bg-pacific-blue-400/10 px-3 py-1 text-[11px] font-semibold text-pacific-blue-100 backdrop-blur-sm">
                      <RemainingText key={activeCard.id} endsAt={activeCard.endsAt} renderedAt={renderedAt} t={tFormat} />
                    </span>
                  </div>

                  <h1 className="mt-5 max-w-[31rem] text-3xl font-black leading-[1.02] text-white sm:text-5xl lg:text-6xl">
                    {activeCard.title}
                  </h1>

                  <p className="mt-4 max-w-[29rem] text-base leading-[1.65] text-pacific-blue-100 sm:text-lg">
                    {activeCard.bidCount === 0
                      ? tListings("noBidsYet")
                      : tListings("totalBids", { count: activeCard.bidCount })}
                  </p>
                </div>

                <div
                  className={`pointer-events-none relative z-10 mt-5 w-full ${
                    activeCard.hasPhoto ? "" : "rounded-2xl bg-white/90 p-2"
                  }`}
                >
                  <div className="aspect-[4/3] w-full">
                    <ProgressiveImage
                      src={activeCard.photoUrl}
                      alt={activeCard.title}
                      eager
                      fetchPriority="high"
                      sizes="(max-width: 640px) 34vw, (max-width: 1024px) 38vw, 30vw"
                      className={`h-full w-full drop-shadow-2xl ${activeCard.hasPhoto ? "object-contain" : "object-contain p-2"}`}
                    />
                  </div>
                </div>

                <div className="relative z-10 mt-6 flex max-w-[33rem] flex-wrap gap-3">
                  <Link
                    href={activeCard.href}
                    className="rounded-full bg-white px-6 py-3 text-sm font-bold text-pacific-blue-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-pacific-blue-50"
                  >
                    {tHome("promoAuctionCta")}
                  </Link>
                  <Link
                    href={browseHref}
                    className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10"
                  >
                    {tHome("browseButton")}
                  </Link>
                </div>

                <div className="relative z-10 mt-12 grid max-w-xl gap-2 text-xs text-pacific-blue-100 sm:grid-cols-3 sm:text-sm">
                  <div className="rounded-xl border border-white/10 bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-pacific-blue-200">{tDetail("specCurrentPrice")}</p>
                    <p className="mt-1 text-base font-bold text-white">{numberFormatter.format(activeCard.currentPrice)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-pacific-blue-200">{tDetail("specBuyNow")}</p>
                    <p className="mt-1 text-base font-bold text-white">
                      {activeCard.buyItNowPrice === null
                        ? tDetail("specNotAvailable")
                        : numberFormatter.format(activeCard.buyItNowPrice)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/12 px-4 py-3 backdrop-blur-sm">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-pacific-blue-200">{tDetail("specEndTime")}</p>
                    <EndTimeCountdown key={activeCard.id} endsAt={activeCard.endsAt} renderedAt={renderedAt} t={tFormat} />
                  </div>
                </div>

                {cards.length > 1 && (
                  <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      {cards.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          aria-label={tHome("slideGoTo", { index: index + 1 })}
                          onClick={() => setActiveIndex(index)}
                          className={`h-2.5 rounded-full transition ${
                            index === activeIndex ? "w-8 bg-white" : "w-2.5 bg-white/35 hover:bg-white/60"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={tHome("slidePrevious")}
                        onClick={() => setActiveIndex((index) => (index - 1 + cards.length) % cards.length)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg text-white backdrop-blur-sm transition hover:bg-white/20"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        aria-label={tHome("slideNext")}
                        onClick={() => setActiveIndex((index) => (index + 1) % cards.length)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg text-white backdrop-blur-sm transition hover:bg-white/20"
                      >
                        →
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="relative z-10 max-w-xl">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-pacific-blue-100 backdrop-blur-sm">
                  {tHome("heroEmptyBadge")}
                </span>
                <h1 className="mt-5 text-4xl font-black leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                  {tListings("noListings")}
                </h1>
                <p className="mt-4 max-w-lg text-base leading-7 text-pacific-blue-100 sm:text-lg">
                  {tHome("promoAuctionDesc")}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href={browseHref} className="rounded-full bg-white px-6 py-3 text-sm font-bold text-pacific-blue-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-pacific-blue-50">
                    {tHome("browseButton")}
                  </Link>
                </div>
              </div>
            )}
          </article>

          <div className="grid gap-4">
            {topPriceCards.map((item, index) => (
              <Link
                key={item.id}
                href={item.href}
                className="group relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className={`pointer-events-none absolute inset-0 opacity-80 ${
                    index === 0
                      ? "bg-gradient-to-br from-pacific-blue-50 via-white to-pacific-blue-50"
                      : "bg-gradient-to-br from-amber-50 via-white to-rose-50"
                  }`}
                />
                <div className="relative">
                  <p className="text-[11px] font-bold uppercase tracking-[0.145em] text-interactive-primary drop-shadow-[0_1px_0_rgba(255,255,255,0.72)]">{tHome("topPriceBadge")}</p>
                  <h2 className="mt-2 line-clamp-2 text-xl font-extrabold leading-tight text-ink">{item.title}</h2>
                  <div className="mt-4 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-white to-yellow-50 px-4 py-3 shadow-[0_8px_20px_rgba(217,119,6,0.12)] ring-1 ring-white/70">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.78)]">{tDetail("specCurrentPrice")}</p>
                    <div className="mt-1 flex items-end gap-2">
                      <span className="text-sm font-semibold text-amber-700">NT$</span>
                      <span className="text-3xl font-black leading-none text-amber-900 sm:text-[2rem]">
                        {numberFormatter.format(item.currentPrice)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-sm font-medium tracking-[0.01em] text-ink-light shadow-[0_4px_10px_rgba(15,23,42,0.08)]">
                      <RemainingText endsAt={item.endsAt} renderedAt={renderedAt} t={tFormat} />
                    </span>
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-header shadow-sm">
                    <span>{tListings("viewDetails")}</span>
                    <span aria-hidden>→</span>
                  </div>

                  {item.photoUrl && (
                    <div
                      className={`mt-5 aspect-[16/9] overflow-hidden rounded-2xl ${
                        item.hasPhoto ? "bg-slate-100" : "bg-white/90"
                      }`}
                    >
                      <ZoomableProductImage
                        src={item.photoUrl}
                        alt={item.title}
                        eager={false}
                        fetchPriority="auto"
                        sizes="(max-width: 1024px) 100vw, 22vw"
                      />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}