"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useRotatingIndex } from "@/lib/useRotatingIndex";

// Homepage carousel card (issue #54) — replaces the static "即刻入手"/"本週
//精選" promo cards (app/[locale]/(with-loading)/page.tsx) with a rotating showcase of the
// latest 入賞鴿/進口鴿 entries. Rotates every 5s via setInterval.
//
// When this category currently has zero pigeon_showcase rows, this used to
// fall back to that original static marketing copy (issue #54) instead of
// rendering an empty card. Issue #71 removes that — "即刻入手"/"本週精選"
// read as stale promo copy once the real carousel shipped, and (unlike
// NewsCarouselCard) `badgeLabel` doubled as both the fallback's badge and
// the active carousel's category badge, so the empty branch below drops the
// badge entirely rather than keep showing it over a blank state. The layout
// slot itself stays occupied — see the `items.length === 0` branch — with a
// neutral "尚無內容" placeholder instead of a fully-empty card.
//
// Issue #146 replaces the old "thumbnail + text beside it" structure with the
// same full-bleed-cover language as NewsCarouselCard: cover image, bottom-up
// gradient scrim, solid pill badge, overlaid title/excerpt, and both CTAs on a
// single bottom row. The image runs at a portrait-ish 4:5 ratio (not the news
// card's wide 21:10) because this card only occupies one of the homepage
// grid's three columns, so a wide crop would leave the overlay text cramped.
// The two variants stay visually distinct through their brand scale: the dark
// variant (入賞鴿) is baltic-blue with a translucent white badge, the light
// variant (進口鴿) is steel-azure — the interactive/primary scale — with a
// solid badge.
export interface PigeonShowcaseCarouselItem {
  id: number;
  name: string;
  excerpt: string;
  /** Pre-resolved by the caller (app/[locale]/page.tsx) to the site placeholder when the item has no 主圖 yet (issue #70). */
  imageUrl: string;
}

const ROTATE_INTERVAL_MS = 5000;

export default function PigeonShowcaseCarouselCard({
  items,
  variant,
  badgeLabel,
  emptyStateTitle,
  emptyStateDesc,
  viewCtaLabel,
  viewMoreLabel,
  viewMoreHref,
}: {
  items: PigeonShowcaseCarouselItem[];
  variant: "dark" | "light";
  badgeLabel: string;
  emptyStateTitle: string;
  emptyStateDesc: string;
  viewCtaLabel: string;
  viewMoreLabel: string;
  viewMoreHref: string;
}) {
  const t = useTranslations("home");
  const [index, setIndex] = useRotatingIndex(items.length, ROTATE_INTERVAL_MS);

  const isDark = variant === "dark";
  const wrapperClass = isDark ? "bg-baltic-blue-900" : "bg-steel-azure-900";
  const scrimClass = isDark
    ? "bg-gradient-to-t from-baltic-blue-950 via-baltic-blue-950/50 to-transparent"
    : "bg-gradient-to-t from-steel-azure-950 via-steel-azure-950/50 to-transparent";
  const badgeClass = isDark ? "bg-white/15 text-white backdrop-blur-sm" : "bg-steel-azure-600 text-white";
  const ctaClass = isDark ? "text-baltic-blue-900 hover:bg-twilight-indigo-600" : "text-steel-azure-900 hover:bg-steel-azure-600";

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-center">
        <p className="text-sm font-bold text-ink-light">{emptyStateTitle}</p>
        <p className="mt-1 text-xs text-ink-light">{emptyStateDesc}</p>
      </div>
    );
  }

  const current = items[index];
  const href = `/pigeon-showcase/${current.id}`;

  return (
    <article className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl shadow-xl ${wrapperClass}`}>
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.imageUrl}
          alt={current.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className={`absolute inset-0 ${scrimClass}`} />
        <div className="absolute left-5 top-5">
          <span className={`inline-flex items-center rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider shadow-md ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h3 className="text-lg font-extrabold leading-snug tracking-tight text-white sm:text-xl">
            <Link href={href} className="transition-opacity hover:opacity-90">
              {current.name}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-2 text-xs text-slate-300">{current.excerpt}</p>
          {items.length > 1 && (
            // Manual dot/arrow controls (issue #156) — this card is a dark
            // overlay card like the Hero, so it reuses HeroSection's own
            // white/translucent dot+arrow styling verbatim (just sized down
            // to fit this card's smaller footprint), kept on its own row so
            // it doesn't compete with the CTA row below for space.
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {items.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={t("slideGoTo", { index: itemIndex + 1 })}
                    onClick={() => setIndex(itemIndex)}
                    className={`h-2 rounded-full transition ${
                      itemIndex === index ? "w-6 bg-white" : "w-2 bg-white/35 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={t("slidePrevious")}
                  onClick={() => setIndex((previous) => (previous - 1 + items.length) % items.length)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-label={t("slideNext")}
                  onClick={() => setIndex((previous) => (previous + 1) % items.length)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  →
                </button>
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 text-xs">
            <Link href={href} className={`inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold transition-colors hover:text-white ${ctaClass}`}>
              {viewCtaLabel}
            </Link>
            <Link href={viewMoreHref} className="inline-flex font-bold text-white/90 underline underline-offset-2 transition-colors hover:text-white">
              {viewMoreLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
