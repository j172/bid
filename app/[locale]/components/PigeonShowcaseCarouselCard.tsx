"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

// Homepage carousel card (issue #54) — replaces the static "即刻入手"/"本週
//精選" promo cards (app/[locale]/page.tsx) with a rotating showcase of the
// latest 入賞鴿/進口鴿 entries. Rotates every 5s via setInterval; falls back
// to the original static marketing copy when this category currently has
// zero pigeon_showcase rows (see the `items.length === 0` branch) rather
// than rendering an empty card.
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
  fallbackTitle,
  fallbackDesc,
  fallbackCtaLabel,
  fallbackCtaHref,
  viewCtaLabel,
  viewMoreLabel,
  viewMoreHref,
}: {
  items: PigeonShowcaseCarouselItem[];
  variant: "dark" | "light";
  badgeLabel: string;
  fallbackTitle: string;
  fallbackDesc: string;
  fallbackCtaLabel: string;
  fallbackCtaHref: string;
  viewCtaLabel: string;
  viewMoreLabel: string;
  viewMoreHref: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % items.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  const isDark = variant === "dark";
  const wrapperClass = isDark
    ? "rounded-2xl bg-gradient-to-r from-yale-blue-700 to-slate-900 p-6 text-white"
    : "rounded-2xl border border-border bg-white p-6";
  const badgeClass = isDark ? "text-xs font-bold uppercase tracking-wider" : "text-xs font-bold uppercase tracking-wider text-interactive-primary";
  const titleClass = isDark ? "mt-2 text-2xl font-black" : "mt-2 text-xl font-black text-ink";
  const descClass = isDark ? "mt-3 text-sm text-pacific-blue-100" : "mt-2 text-sm text-ink-light";
  const ctaClass = isDark
    ? "mt-4 inline-flex rounded-md bg-white px-3 py-1.5 text-xs font-bold text-pacific-blue-700"
    : "mt-4 inline-flex rounded-md bg-header px-3 py-1.5 text-xs font-bold text-white";
  const viewMoreClass = isDark
    ? "mt-4 inline-flex text-xs font-bold text-white/90 underline underline-offset-2 hover:text-white"
    : "mt-4 inline-flex text-xs font-bold text-interactive-primary underline underline-offset-2 hover:text-header";

  if (items.length === 0) {
    return (
      <div className={wrapperClass}>
        <p className={badgeClass}>{badgeLabel}</p>
        <h3 className={titleClass}>{fallbackTitle}</h3>
        <p className={descClass}>{fallbackDesc}</p>
        <Link href={fallbackCtaHref} className={ctaClass}>
          {fallbackCtaLabel}
        </Link>
      </div>
    );
  }

  const current = items[index];

  return (
    <div className={wrapperClass}>
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.imageUrl} alt={current.name} className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className={badgeClass}>{badgeLabel}</p>
          <h3 className={`${titleClass} truncate`}>{current.name}</h3>
          <p className={`${descClass} line-clamp-2`}>{current.excerpt}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4">
        <Link href={`/pigeon-showcase/${current.id}`} className={ctaClass}>
          {viewCtaLabel}
        </Link>
        <Link href={viewMoreHref} className={viewMoreClass}>
          {viewMoreLabel}
        </Link>
      </div>
    </div>
  );
}
